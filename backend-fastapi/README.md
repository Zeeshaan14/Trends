# NU Jerseys — Backend API

This is the FastAPI backend for **NU Jerseys**. It handles authentication, product management, order processing via Razorpay, and secure digital file delivery via Cloudflare R2.

## 🚀 Key Features

*   **FastAPI & Async**: Built with modern, asynchronous Python for high performance.
*   **PostgreSQL**: Relational database via SQLAlchemy 2.0 (asyncio).
*   **Authentication**: JWT-based authentication for the admin dashboard.
*   **Cloudflare R2 Integration**: 
    *   Secure, private storage for `.zip` design files (accessed via expiring presigned URLs).
    *   Public storage for product preview images (served instantly via a public URL).
*   **Payments**: Razorpay integration for seamless order checkouts.

## 🛠️ Tech Stack

*   **Framework**: FastAPI
*   **Database ORM**: SQLAlchemy (Async)
*   **Migrations**: Alembic
*   **Storage API**: `boto3` (AWS SDK configured for Cloudflare R2)
*   **Payments**: `razorpay` Python SDK

## 📦 Getting Started

### 1. Prerequisites

*   Python 3.10 or later
*   PostgreSQL running locally or via Docker
*   A Cloudflare R2 Bucket
*   A Razorpay Developer Account

### 2. Installation & Setup

Navigate to the `backend-fastapi` directory and create a virtual environment:

```bash
cd backend-fastapi
python -m venv .venv
```

Activate the virtual environment:
*   **Windows**: `.venv\Scripts\activate`
*   **macOS/Linux**: `source .venv/bin/activate`

Install dependencies:

```bash
pip install -r requirements.txt
```

### 3. Environment Variables

Copy the example environment file and configure it:

```bash
cp .env.example .env
```

Open `.env` and fill in your details:
*   `DATABASE_URL`: Your PostgreSQL connection string.
*   `SECRET_KEY`: A strong random string for JWTs.
*   `RAZORPAY_*`: Your Razorpay API keys.
*   `R2_*`: Your Cloudflare R2 credentials and bucket details. Note that `R2_PUBLIC_BASE_URL` should be your public R2 custom domain (e.g., `https://cdn.nujerseys.com`).

### 4. Database Migrations

Run Alembic to create the database tables:

```bash
alembic upgrade head
```

### 5. Create Initial Admin User (Optional)

You can run a script or use a database tool to insert your first admin user with `role='admin'` to log into the admin dashboard.

### 6. Running the Development Server

Start the FastAPI development server:

```bash
uvicorn app.main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`. 
You can view the interactive API documentation (Swagger UI) at `http://localhost:8000/docs`.

## 📁 Project Structure

*   `app/`: Main application code.
    *   `models/`: SQLAlchemy database models.
    *   `schemas/`: Pydantic models for request/response validation.
    *   `routers/`: API endpoints grouped by feature (`jerseys.py`, `orders.py`, `admin.py`).
    *   `services/`: Business logic integrations (`r2_service.py`, `razorpay_service.py`).
    *   `main.py`: FastAPI application entry point.
*   `alembic/`: Database migration scripts.
