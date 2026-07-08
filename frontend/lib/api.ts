import {
    Category,
    CategoryWithJerseys,
    Jersey,
    JerseysResponse,
    ApiResponse,
    CreateOrderRequest,
    Order
} from "./types"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api"

if (!process.env.NEXT_PUBLIC_API_URL && process.env.NODE_ENV === "production") {
    throw new Error("NEXT_PUBLIC_API_URL is required in production environment.")
}

class ApiError extends Error {
    constructor(public status: number, message: string) {
        super(message)
        this.name = "ApiError"
    }
}

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${API_BASE}${endpoint}`
    console.log("[fetchApi] Calling:", url)

    const response = await fetch(url, {
        ...options,
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
            ...options?.headers,
        },
    })

    if (!response.ok) {
        const error = await response.json().catch(() => ({ message: "Request failed" }))
        const detail = Array.isArray(error.detail)
            ? error.detail.map((item: { msg?: string }) => item.msg).filter(Boolean).join("; ")
            : undefined
        throw new ApiError(
            response.status,
            error.message || error.error || detail || "Request failed",
        )
    }

    return response.json()
}

// ============================================
// Categories
// ============================================

export async function getCategories(): Promise<Category[]> {
    const response = await fetchApi<ApiResponse<Category[]>>("/categories")
    return response.data
}

export async function getCategoryById(id: string): Promise<CategoryWithJerseys> {
    const response = await fetchApi<ApiResponse<CategoryWithJerseys>>(`/categories/${id}`)
    return response.data
}

// ============================================
// Jerseys
// ============================================

interface GetJerseysParams {
    categoryId?: string
    search?: string
    minPrice?: number
    maxPrice?: number
    page?: number
    limit?: number
}

export async function getJerseys(params?: GetJerseysParams): Promise<JerseysResponse> {
    const searchParams = new URLSearchParams()

    if (params?.categoryId) searchParams.set("categoryId", params.categoryId)
    if (params?.search) searchParams.set("search", params.search)
    if (params?.minPrice) searchParams.set("minPrice", params.minPrice.toString())
    if (params?.maxPrice) searchParams.set("maxPrice", params.maxPrice.toString())
    if (params?.page) searchParams.set("page", params.page.toString())
    if (params?.limit) searchParams.set("limit", params.limit.toString())

    const query = searchParams.toString()
    const endpoint = query ? `/jerseys?${query}` : "/jerseys"

    return fetchApi<JerseysResponse>(endpoint)
}

export async function getJerseyById(id: number): Promise<Jersey> {
    const response = await fetchApi<ApiResponse<Jersey>>(`/jerseys/${id}`)
    return response.data
}

// ============================================
// Orders
// ============================================

export async function createOrder(data: CreateOrderRequest): Promise<Order> {
    const response = await fetchApi<ApiResponse<Order>>("/orders", {
        method: "POST",
        body: JSON.stringify(data),
    })
    return response.data
}

export async function getOrderById(orderId: string, email: string): Promise<any> {
    const response = await fetchApi<ApiResponse<any>>(`/orders/${orderId}/verify`, {
        method: "POST",
        body: JSON.stringify({ email }),
    })
    return response.data
}

export async function verifyPayment(data: import("./types").VerifyPaymentRequest): Promise<import("./types").VerifyPaymentResponse> {
    const response = await fetchApi<ApiResponse<import("./types").VerifyPaymentResponse>>("/payments/verify", {
        method: "POST",
        body: JSON.stringify(data),
    })
    return response.data
}

export async function getDesignDownloadUrl(
    orderId: string,
    jerseyId: number,
    email: string
): Promise<{ download_url: string; expires_in: number }> {
    const response = await fetchApi<ApiResponse<{ download_url: string; expires_in: number }>>(
        `/orders/${orderId}/download/${jerseyId}`,
        {
            method: "POST",
            body: JSON.stringify({ email }),
        }
    )
    return response.data
}

// ============================================
// Admin API
// ============================================

export interface AdminUser {
    id: string
    email: string
    companyName: string
    role: string
}

export interface AdminLoginResponse {
    accessToken: string
    refreshToken: string
    user: AdminUser
}

export interface DashboardStats {
    stats: {
        totalUsers: number
        totalOrders: number
        totalJerseys: number
        totalRevenue: number
        ordersByStatus: { status: string; _count: number }[]
    }
    recentOrders: any[]
    recentPayments: any[]
}

export interface AdminOrder {
    id: string
    status: string
    subtotal: number
    tax: number
    total: number
    createdAt: string
    user: {
        id: string
        companyName: string
        email: string
        phone: string
    }
    items: {
        id: string
        quantity: number
        price: number
        jersey: {
            id: number
            name: string
            player: string
            image: string
        }
    }[]
    payment: {
        id: string
        status: string
        method: string
    } | null
}

export async function adminLogin(email: string, password: string): Promise<AdminLoginResponse> {
    const response = await fetchApi<ApiResponse<AdminLoginResponse>>("/auth/admin/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
    })
    return response.data
}

export async function getDashboardStats(token?: string): Promise<DashboardStats> {
    const headers: Record<string, string> = {}
    if (token) headers["Authorization"] = `Bearer ${token}`
    const response = await fetchApi<ApiResponse<DashboardStats>>("/admin/dashboard", { headers })
    return response.data
}

async function getJerseyUploadUrl(
    token: string,
    fileType: "design" | "preview",
    file: File,
    jerseyId?: number,
): Promise<{ uploadUrl: string; fileKey: string; signedContentType: string }> {
    const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
    }

    // The backend determines the canonical content-type used to sign the URL.
    // For design files it always uses "application/zip" regardless of what the
    // browser reports in file.type. We must pass the EXACT same value on the PUT.
    const signedContentType =
        fileType === "design"
            ? "application/zip"
            : file.type && file.type !== "application/octet-stream"
              ? file.type
              : "image/jpeg"

    const response = await fetchApi<ApiResponse<{ uploadUrl: string; fileKey: string }>>(
        "/jerseys/upload-url",
        {
            method: "POST",
            headers,
            body: JSON.stringify({
                fileType,
                filename: file.name,
                contentType: signedContentType,
                jerseyId,
            }),
        },
    )

    return { ...response.data, signedContentType }
}

async function uploadFileToR2(uploadUrl: string, file: File, contentType: string): Promise<void> {
    console.log("[uploadFileToR2] PUT", uploadUrl, "contentType:", contentType, "fileSize:", file.size)
    const response = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
            // Must exactly match the ContentType the presigned URL was signed with.
            "Content-Type": contentType,
        },
        body: file,
    })

    if (!response.ok) {
        const body = await response.text().catch(() => "")
        console.error("[uploadFileToR2] PUT failed:", response.status, body)
        throw new ApiError(
            response.status,
            `Failed to upload file to storage (${response.status}). ` +
            `Check R2 CORS settings and that Content-Type matches the signed URL. ` +
            (body ? `R2 said: ${body.slice(0, 200)}` : ""),
        )
    }
    console.log("[uploadFileToR2] PUT success:", response.status)
}

async function uploadJerseyFilesViaPresignedUrl(
    token: string,
    data: { designFile?: File; previewImage?: File },
    jerseyId?: number,
): Promise<{ designFileKey?: string; previewImageKey?: string }> {
    let designFileKey: string | undefined
    let previewImageKey: string | undefined

    if (data.designFile) {
        const { uploadUrl, fileKey, signedContentType } = await getJerseyUploadUrl(token, "design", data.designFile, jerseyId)
        await uploadFileToR2(uploadUrl, data.designFile, signedContentType)
        designFileKey = fileKey
    }

    if (data.previewImage) {
        const { uploadUrl, fileKey, signedContentType } = await getJerseyUploadUrl(token, "preview", data.previewImage, jerseyId)
        await uploadFileToR2(uploadUrl, data.previewImage, signedContentType)
        previewImageKey = fileKey
    }

    return { designFileKey, previewImageKey }
}

export async function getAdminOrders(token?: string, status?: string): Promise<{ data: AdminOrder[]; pagination: any }> {
    const params = new URLSearchParams()
    if (status) params.set("status", status)
    const query = params.toString()

    const headers: Record<string, string> = {}
    if (token) headers["Authorization"] = `Bearer ${token}`

    const response = await fetchApi<{ success: boolean; data: AdminOrder[]; pagination: any }>(
        `/admin/orders${query ? `?${query}` : ""}`,
        { headers }
    )
    return { data: response.data, pagination: response.pagination }
}

export async function createJerseyAdmin(token?: string, data?: {
    name: string
    player: string
    price: number
    originalPrice?: number
    image?: string
    badge?: string
    badgeColor?: string
    categoryId: string
    designFile?: File
    previewImage?: File
}): Promise<Jersey> {
    if (!token) {
        throw new ApiError(401, "Admin authentication required")
    }

    const uploadedKeys = await uploadJerseyFilesViaPresignedUrl(token, {
        designFile: data?.designFile,
        previewImage: data?.previewImage,
    })

    const formData = new FormData()
    if (data) {
        formData.append("name", data.name)
        formData.append("player", data.player)
        formData.append("price", data.price.toString())
        if (data.originalPrice) formData.append("originalPrice", data.originalPrice.toString())
        if (data.image) formData.append("image", data.image)
        if (data.badge) formData.append("badge", data.badge)
        if (data.badgeColor) formData.append("badgeColor", data.badgeColor)
        formData.append("categoryId", data.categoryId)
        if (uploadedKeys.designFileKey) formData.append("designFileKey", uploadedKeys.designFileKey)
        if (uploadedKeys.previewImageKey) formData.append("previewImageKey", uploadedKeys.previewImageKey)
    }

    const url = `${API_BASE}/jerseys`
    const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
    }

    const response = await fetch(url, {
        method: "POST",
        headers,
        body: formData,
        credentials: "include",
    })

    if (!response.ok) {
        const error = await response.json().catch(() => ({ message: "Request failed" }))
        throw new ApiError(response.status, error.message || error.error || "Request failed")
    }

    const json = await response.json()
    return json.data
}

export async function updateOrderStatus(token?: string, orderId?: string, status?: string): Promise<any> {
    const headers: Record<string, string> = {}
    if (token) headers["Authorization"] = `Bearer ${token}`

    const response = await fetchApi<ApiResponse<any>>(`/admin/orders/${orderId}/status`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ status }),
    })
    return response.data
}

export async function updateJerseyAdmin(token?: string, id?: number, data?: {
    name?: string
    player?: string
    price?: number
    originalPrice?: number
    image?: string
    badge?: string
    badgeColor?: string
    categoryId?: string
    designFile?: File
    previewImage?: File
}): Promise<Jersey> {
    if (!token || id === undefined) {
        throw new ApiError(401, "Admin authentication required")
    }

    const uploadedKeys = await uploadJerseyFilesViaPresignedUrl(
        token,
        {
            designFile: data?.designFile,
            previewImage: data?.previewImage,
        },
        id,
    )

    const formData = new FormData()
    if (data) {
        if (data.name) formData.append("name", data.name)
        if (data.player) formData.append("player", data.player)
        if (data.price !== undefined) formData.append("price", data.price.toString())
        if (data.originalPrice !== undefined) formData.append("originalPrice", data.originalPrice.toString())
        if (data.image) formData.append("image", data.image)
        if (data.badge !== undefined) formData.append("badge", data.badge || "")
        if (data.badgeColor !== undefined) formData.append("badgeColor", data.badgeColor || "")
        if (data.categoryId) formData.append("categoryId", data.categoryId)
        if (uploadedKeys.designFileKey) formData.append("designFileKey", uploadedKeys.designFileKey)
        if (uploadedKeys.previewImageKey) formData.append("previewImageKey", uploadedKeys.previewImageKey)
    }

    const url = `${API_BASE}/jerseys/${id}`
    const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
    }

    const response = await fetch(url, {
        method: "PATCH",
        headers,
        body: formData,
        credentials: "include",
    })

    if (!response.ok) {
        const error = await response.json().catch(() => ({ message: "Request failed" }))
        throw new ApiError(response.status, error.message || error.error || "Request failed")
    }

    const json = await response.json()
    return json.data
}

export async function deleteJerseyAdmin(token?: string, id?: number): Promise<void> {
    const headers: Record<string, string> = {}
    if (token) headers["Authorization"] = `Bearer ${token}`

    const response = await fetchApi<ApiResponse<any>>(`/jerseys/${id}`, {
        method: "DELETE",
        headers,
    })
    return response.data
}

export { ApiError }

