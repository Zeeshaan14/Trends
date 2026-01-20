import { Request, Response } from "express";
import { prisma } from "../utils/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { createError } from "../middleware/errorHandler";

// Create order from cart items
export const createOrder = asyncHandler(async (req: Request, res: Response) => {
    const { companyName, email, phone, items } = req.body;

    if (!companyName || !email || !phone) {
        throw createError("Company name, email, and phone are required", 400);
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
        throw createError("Cart items are required", 400);
    }

    // Find or create user
    let user = await prisma.user.findUnique({
        where: { email },
    });

    if (!user) {
        user = await prisma.user.create({
            data: { companyName, email, phone, role: "USER" },
        });
    } else {
        // Update user info if they exist
        user = await prisma.user.update({
            where: { email },
            data: { companyName, phone },
        });
    }

    // Validate items and get jersey details
    const jerseyIds = items.map((item: { jerseyId: number }) => item.jerseyId);
    const jerseys = await prisma.jersey.findMany({
        where: { id: { in: jerseyIds } },
    });

    if (jerseys.length !== jerseyIds.length) {
        throw createError("One or more jerseys not found", 400);
    }

    // Create a map for easy lookup
    const jerseyMap = new Map(jerseys.map(j => [j.id, j]));

    // Calculate totals
    let subtotal = 0;
    const orderItems = items.map((item: { jerseyId: number; quantity: number }) => {
        const jersey = jerseyMap.get(item.jerseyId)!;
        subtotal += Number(jersey.price) * item.quantity;
        return {
            jerseyId: item.jerseyId,
            quantity: item.quantity,
            price: jersey.price,
        };
    });

    const tax = subtotal * 0; // 18% GST
    const total = subtotal + tax;

    // Create order with items
    const order = await prisma.order.create({
        data: {
            userId: user.id,
            status: "PENDING",
            subtotal,
            tax,
            total,
            items: {
                create: orderItems,
            },
        },
        include: {
            items: {
                include: { jersey: true },
            },
            user: true,
        },
    });

    res.status(201).json({
        success: true,
        data: order,
        message: "Order created successfully",
    });
});


// Get order by ID (with download links if paid)
export const getOrderById = asyncHandler(async (req: Request, res: Response) => {
    const order = await prisma.order.findUnique({
        where: { id: req.params.id },
        include: {
            items: {
                include: {
                    jersey: {
                        select: {
                            id: true,
                            name: true,
                            player: true,
                            image: true,
                            price: true,
                            // Only include downloadUrl if order is paid
                            downloadUrl: true,
                        },
                    },
                },
            },
            payment: true,
            user: true,
        },
    });

    if (!order) {
        throw createError("Order not found", 404);
    }

    // Hide download URLs if not paid
    const responseData = {
        ...order,
        items: order.items.map((item: (typeof order.items)[number]) => ({
            ...item,
            jersey: {
                ...item.jersey,
                downloadUrl: order.status === "PAID" ? item.jersey.downloadUrl : undefined,
            },
        })),
    };

    res.json({
        success: true,
        data: responseData,
    });
});

// Get user's orders
export const getUserOrders = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;

    const orders = await prisma.order.findMany({
        where: { userId },
        include: {
            items: {
                include: { jersey: true },
            },
            payment: true,
        },
        orderBy: { createdAt: "desc" },
    });

    res.json({
        success: true,
        data: orders,
    });
});
