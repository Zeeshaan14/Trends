// TypeScript types matching backend API responses

export interface Category {
    id: string
    name: string
    image: string
    description: string
    _count?: {
        jerseys: number
    }
}

export interface CategoryWithJerseys extends Category {
    jerseys: Jersey[]
}

export interface Jersey {
    id: number
    name: string
    player: string
    price: number
    originalPrice: number | null
    rating: number
    reviewCount: number
    image: string
    hasDesignFile?: boolean
    badge: string | null
    badgeColor: string | null
    categoryId: string
    category?: Category
    createdAt: string
    updatedAt: string
}

export interface Pagination {
    page: number
    limit: number
    total: number
    totalPages: number
}

export interface ApiResponse<T> {
    success: boolean
    data: T
    message?: string
}

export interface JerseysResponse {
    success: boolean
    data: Jersey[]
    pagination: Pagination
}

export interface CartItemData {
    id: number
    name: string
    player: string
    price: number
    image: string
    quantity: number
}

export interface OrderItem {
    jerseyId: number
    quantity: number
    price: number
}

export interface CreateOrderRequest {
    companyName: string
    email: string
    phone: string
    items: {
        jerseyId: number
        quantity: number
    }[]
}

export interface Order {
    id: string
    userId: string
    status: "PENDING" | "PAID" | "CANCELLED"
    subtotal: number
    tax: number
    total: number
    items: OrderItem[]
    createdAt: string
    razorpayOrderId?: string
    razorpayKeyId?: string
}

export interface VerifyPaymentRequest {
    orderId: string
    razorpayOrderId: string
    razorpayPaymentId: string
    razorpaySignature: string
}

export interface VerifyPaymentResponse {
    payment: {
        id: string
        status: string
        amount: number
    }
    order: {
        id: string
        status: string
    }
    downloadItems: {
        jerseyId: number
        name: string
        hasDesignFile: boolean
    }[]
}
