# NU Jerseys — Frontend Application

This is the frontend web application for **NU Jerseys**, a digital storefront for premium jersey designs. It is built with [Next.js](https://nextjs.org) (App Router), React, and Tailwind CSS.

## 🚀 Key Features

*   **Public Storefront**: Browse categories, view jersey details, and see public preview images (loaded directly from Cloudflare R2).
*   **Shopping Cart & Checkout**: Add digital designs to your cart and seamlessly checkout using the Razorpay integration.
*   **Admin Dashboard**: A secure portal for administrators to manage products, view order history, and monitor revenue stats.
*   **Digital Delivery**: After a successful purchase, customers can download their high-resolution vector design files (`.zip`) directly via secure, expiring presigned URLs.

## 🛠️ Tech Stack

*   **Framework**: Next.js (App Router)
*   **Language**: TypeScript
*   **Styling**: Tailwind CSS & `shadcn/ui` components
*   **Icons**: Lucide React
*   **State Management**: React Context (Cart)

## 📦 Getting Started

### 1. Prerequisites

*   Node.js 18.x or later
*   `pnpm` (recommended), `npm`, or `yarn`

### 2. Installation

Navigate to the `frontend` directory and install the dependencies:

```bash
cd frontend
pnpm install
```

### 3. Environment Variables

Create a `.env.local` file in the root of the `frontend` directory based on the following:

```env
# The URL of your running FastAPI backend
NEXT_PUBLIC_API_URL=http://localhost:8000/api
```

### 4. Running the Development Server

Start the development server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## 📁 Project Structure

*   `app/`: Contains the Next.js App Router pages and layouts.
    *   `app/admin/`: Admin dashboard routes.
    *   `app/jerseys/`: Public jersey product pages.
    *   `app/checkout/`: Checkout flow.
*   `components/`: Reusable UI components (buttons, cards, inputs).
*   `context/`: React Context providers (e.g., `cart-context.tsx`).
*   `lib/`: Utility functions and the API client (`api.ts`).

## 🔗 Integration with Backend

The frontend communicates exclusively with the FastAPI backend located in the `backend-fastapi` folder. Ensure the backend is running concurrently when testing full flows like creating products or processing checkouts.

For serving images, the frontend utilizes Cloudflare R2 URLs. Preview images are public, whereas purchased `.zip` files are downloaded using generated presigned URLs requested from the backend.
