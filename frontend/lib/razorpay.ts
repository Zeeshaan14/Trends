export interface RazorpayOptions {
    key: string
    amount: number
    currency: string
    name: string
    description?: string
    image?: string
    order_id: string
    handler: (response: RazorpayResponse) => void
    prefill?: {
        name?: string
        email?: string
        contact?: string
    }
    notes?: {
        [key: string]: string
    }
    theme?: {
        color?: string
    }
    modal?: {
        ondismiss?: () => void
    }
}

export interface RazorpayResponse {
    razorpay_payment_id: string
    razorpay_order_id: string
    razorpay_signature: string
}

declare global {
    interface Window {
        Razorpay: any
    }
}

export function loadRazorpayScript(): Promise<boolean> {
    return new Promise((resolve) => {
        if (typeof window === "undefined") {
            resolve(false)
            return
        }

        if (window.Razorpay) {
            resolve(true)
            return
        }

        if (document.getElementById("razorpay-script")) {
            resolve(true)
            return
        }

        const script = document.createElement("script")
        script.id = "razorpay-script"
        script.src = "https://checkout.razorpay.com/v1/checkout.js"
        script.onload = () => resolve(true)
        script.onerror = () => resolve(false)
        document.body.appendChild(script)
    })
}

export async function openRazorpayCheckout(options: RazorpayOptions): Promise<void> {
    const isLoaded = await loadRazorpayScript()
    if (!isLoaded) {
        throw new Error("Razorpay SDK failed to load. Are you online?")
    }

    const rzp = new window.Razorpay(options)
    
    // Handle payment failures natively via Razorpay
    rzp.on('payment.failed', function (response: any) {
        console.error("Payment failed", response.error)
        // Options could be extended to handle this
    })

    rzp.open()
}
