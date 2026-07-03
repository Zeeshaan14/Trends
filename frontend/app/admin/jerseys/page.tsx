"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { ArrowLeft, Plus, Shirt, RefreshCw, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/use-toast"
import { getJerseys, getCategories, createJerseyAdmin, AdminLoginResponse } from "@/lib/api"
import { Jersey, Category } from "@/lib/types"

export default function AdminJerseysPage() {
    const router = useRouter()
    const { toast } = useToast()
    const [session, setSession] = useState<AdminLoginResponse | null>(null)
    const [jerseys, setJerseys] = useState<Jersey[]>([])
    const [categories, setCategories] = useState<Category[]>([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [submitting, setSubmitting] = useState(false)

    const [formData, setFormData] = useState({
        name: "",
        player: "",
        price: "",
        originalPrice: "",
        image: "",
        badge: "",
        badgeColor: "",
        categoryId: "",
    })
    const [designFile, setDesignFile] = useState<File | null>(null)

    useEffect(() => {
        const stored = localStorage.getItem("adminUser")
        if (!stored) {
            router.push("/admin")
            return
        }
        setSession(JSON.parse(stored))
    }, [router])

    useEffect(() => {
        Promise.all([
            getJerseys({ limit: 100 }),
            getCategories(),
        ])
            .then(([jerseysRes, categoriesRes]) => {
                setJerseys(jerseysRes.data)
                setCategories(categoriesRes)
            })
            .catch(console.error)
            .finally(() => setLoading(false))
    }, [])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!session) return

        if (!formData.name || !formData.player || !formData.price || !formData.image || !formData.categoryId) {
            toast({ title: "Missing Fields", description: "Please fill in all required fields." })
            return
        }

        setSubmitting(true)
        try {
            const newJersey = await createJerseyAdmin(session.accessToken, {
                name: formData.name,
                player: formData.player,
                price: parseFloat(formData.price),
                originalPrice: formData.originalPrice ? parseFloat(formData.originalPrice) : undefined,
                image: formData.image,
                badge: formData.badge || undefined,
                badgeColor: formData.badgeColor || undefined,
                categoryId: formData.categoryId,
                designFile: designFile || undefined,
            })

            setJerseys([newJersey, ...jerseys])
            setFormData({
                name: "", player: "", price: "", originalPrice: "",
                image: "", badge: "", badgeColor: "", categoryId: "",
            })
            setDesignFile(null)
            setShowForm(false)
            toast({ title: "Success", description: "Jersey created successfully!" })
        } catch (error: any) {
            toast({ title: "Error", description: error.message || "Failed to create jersey" })
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="min-h-screen bg-background pt-24 pb-12 px-4">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <Link
                        href="/admin/dashboard"
                        className="inline-flex items-center text-muted-foreground hover:text-foreground mb-4"
                    >
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back to Dashboard
                    </Link>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <h1 className="font-[var(--font-oswald)] text-4xl font-bold text-foreground">
                            JERSEYS
                        </h1>
                        <Button onClick={() => setShowForm(!showForm)} className="gap-2">
                            <Plus className="h-4 w-4" />
                            Add New Jersey
                        </Button>
                    </div>
                </div>

                {/* Create Form */}
                {showForm && (
                    <div className="bg-secondary/30 rounded-xl p-6 mb-8">
                        <h2 className="font-semibold text-lg text-foreground mb-4">Create New Jersey</h2>
                        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-2">Name *</label>
                                <Input
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="Lakers City Edition"
                                    className="bg-background"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-2">Player *</label>
                                <Input
                                    value={formData.player}
                                    onChange={(e) => setFormData({ ...formData, player: e.target.value })}
                                    placeholder="LeBron James #23"
                                    className="bg-background"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-2">Price *</label>
                                <Input
                                    type="number"
                                    value={formData.price}
                                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                                    placeholder="999"
                                    className="bg-background"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-2">Original Price</label>
                                <Input
                                    type="number"
                                    value={formData.originalPrice}
                                    onChange={(e) => setFormData({ ...formData, originalPrice: e.target.value })}
                                    placeholder="1299"
                                    className="bg-background"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-2">Image URL *</label>
                                <Input
                                    value={formData.image}
                                    onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                                    placeholder="/jersey-image.png"
                                    className="bg-background"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-2">Design File (.zip)</label>
                                <div className="relative">
                                    <input
                                        type="file"
                                        accept=".zip,application/zip,application/x-zip-compressed"
                                        onChange={(e) => setDesignFile(e.target.files?.[0] || null)}
                                        className="w-full h-10 px-3 py-2 rounded-md bg-background border border-border text-foreground text-sm file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                                    />
                                    {designFile && (
                                        <p className="text-xs text-muted-foreground mt-1">
                                            <Upload className="inline h-3 w-3 mr-1" />
                                            {designFile.name} ({(designFile.size / 1024 / 1024).toFixed(1)}MB)
                                        </p>
                                    )}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-2">Category *</label>
                                <select
                                    value={formData.categoryId}
                                    onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                                    className="w-full h-10 px-3 rounded-md bg-background border border-border text-foreground"
                                >
                                    <option value="">Select category</option>
                                    {categories.map((cat) => (
                                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-2">Badge</label>
                                <Input
                                    value={formData.badge}
                                    onChange={(e) => setFormData({ ...formData, badge: e.target.value })}
                                    placeholder="Best Seller"
                                    className="bg-background"
                                />
                            </div>
                            <div className="md:col-span-2 flex gap-2">
                                <Button type="submit" disabled={submitting}>
                                    {submitting ? "Creating..." : "Create Jersey"}
                                </Button>
                                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                                    Cancel
                                </Button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Jerseys Grid */}
                {loading ? (
                    <div className="flex justify-center py-12">
                        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                ) : jerseys.length === 0 ? (
                    <div className="text-center py-12">
                        <Shirt className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">No jerseys found</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {jerseys.map((jersey) => (
                            <div key={jersey.id} className="bg-secondary/30 rounded-xl overflow-hidden">
                                <div className="relative aspect-[3/4]">
                                    <Image
                                        src={jersey.image || "/placeholder.svg"}
                                        alt={jersey.name}
                                        fill
                                        className="object-cover"
                                    />
                                    {jersey.badge && (
                                        <span className={`absolute top-2 left-2 text-xs px-2 py-1 rounded ${jersey.badgeColor || "bg-primary text-primary-foreground"}`}>
                                            {jersey.badge}
                                        </span>
                                    )}
                                </div>
                                <div className="p-4">
                                    <h3 className="font-semibold text-foreground text-sm line-clamp-1">{jersey.name}</h3>
                                    <p className="text-xs text-muted-foreground">{jersey.player}</p>
                                    <div className="flex items-center justify-between mt-2">
                                        <span className="font-bold text-foreground">₹{Number(jersey.price).toFixed(0)}</span>
                                        <span className="text-xs text-muted-foreground">{jersey.categoryId}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
