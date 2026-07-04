import {
    Category,
    CategoryWithJerseys,
    Jersey,
    JerseysResponse,
    ApiResponse,
    CreateOrderRequest,
    Order
} from "./types"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api"

class ApiError extends Error {
    constructor(public status: number, message: string) {
        super(message)
        this.name = "ApiError"
    }
}

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${API_BASE}${endpoint}`

    const response = await fetch(url, {
        headers: {
            "Content-Type": "application/json",
            ...options?.headers,
        },
        ...options,
    })

    if (!response.ok) {
        const error = await response.json().catch(() => ({ message: "Request failed" }))
        throw new ApiError(response.status, error.message || "Request failed")
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

export async function getDashboardStats(token: string): Promise<DashboardStats> {
    const response = await fetchApi<ApiResponse<DashboardStats>>("/admin/dashboard", {
        headers: { "Authorization": `Bearer ${token}` },
    })
    return response.data
}

export async function getAdminOrders(token: string, status?: string): Promise<{ data: AdminOrder[]; pagination: any }> {
    const params = new URLSearchParams()
    if (status) params.set("status", status)
    const query = params.toString()

    const response = await fetchApi<{ success: boolean; data: AdminOrder[]; pagination: any }>(
        `/admin/orders${query ? `?${query}` : ""}`,
        { headers: { "Authorization": `Bearer ${token}` } }
    )
    return { data: response.data, pagination: response.pagination }
}

export async function createJerseyAdmin(token: string, data: {
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
    const formData = new FormData()
    formData.append("name", data.name)
    formData.append("player", data.player)
    formData.append("price", data.price.toString())
    if (data.originalPrice) formData.append("originalPrice", data.originalPrice.toString())
    if (data.image) formData.append("image", data.image)
    if (data.badge) formData.append("badge", data.badge)
    if (data.badgeColor) formData.append("badgeColor", data.badgeColor)
    formData.append("categoryId", data.categoryId)
    if (data.designFile) formData.append("design_file", data.designFile)
    if (data.previewImage) formData.append("preview_image", data.previewImage)

    const url = `${API_BASE}/jerseys`
    const response = await fetch(url, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` },
        body: formData,
    })

    if (!response.ok) {
        const error = await response.json().catch(() => ({ message: "Request failed" }))
        throw new ApiError(response.status, error.message || error.error || "Request failed")
    }

    const json = await response.json()
    return json.data
}

export async function updateOrderStatus(token: string, orderId: string, status: string): Promise<any> {
    const response = await fetchApi<ApiResponse<any>>(`/admin/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ status }),
    })
    return response.data
}

export async function updateJerseyAdmin(token: string, id: number, data: {
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
    const formData = new FormData()
    if (data.name) formData.append("name", data.name)
    if (data.player) formData.append("player", data.player)
    if (data.price !== undefined) formData.append("price", data.price.toString())
    if (data.originalPrice !== undefined) formData.append("originalPrice", data.originalPrice.toString())
    if (data.image) formData.append("image", data.image)
    if (data.badge !== undefined) formData.append("badge", data.badge || "")
    if (data.badgeColor !== undefined) formData.append("badgeColor", data.badgeColor || "")
    if (data.categoryId) formData.append("categoryId", data.categoryId)
    if (data.designFile) formData.append("design_file", data.designFile)
    if (data.previewImage) formData.append("preview_image", data.previewImage)

    const url = `${API_BASE}/jerseys/${id}`
    const response = await fetch(url, {
        method: "PATCH",
        headers: { "Authorization": `Bearer ${token}` },
        body: formData,
    })

    if (!response.ok) {
        const error = await response.json().catch(() => ({ message: "Request failed" }))
        throw new ApiError(response.status, error.message || error.error || "Request failed")
    }

    const json = await response.json()
    return json.data
}

export async function deleteJerseyAdmin(token: string, id: number): Promise<void> {
    const response = await fetchApi<ApiResponse<any>>(`/jerseys/${id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` },
    })
    return response.data
}

export { ApiError }

