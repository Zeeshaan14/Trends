"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { ArrowLeft, Plus, Shirt, RefreshCw, Upload, Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/use-toast"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { getJerseys, createJerseyAdmin, updateJerseyAdmin, deleteJerseyAdmin } from "@/lib/api"
import { Jersey } from "@/lib/types"
import { useAdminSession } from "@/hooks/use-admin-session"

const MAX_DESIGN_FILE_SIZE = 100 * 1024 * 1024 // 100MB
const MAX_PREVIEW_IMAGE_SIZE = 10 * 1024 * 1024 // 10MB

export default function AdminJerseysPage() {
    const router = useRouter()
    const { toast } = useToast()
    const { admin, token } = useAdminSession(true)
    const [jerseys, setJerseys] = useState<Jersey[]>([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [editingId, setEditingId] = useState<number | null>(null)

    const [formData, setFormData] = useState({
        name: "",
        player: "",
        price: "",
        originalPrice: "",
        image: "",
        badge: "",
        badgeColor: "",
    })
    const [designFile, setDesignFile] = useState<File | null>(null)
    const [previewImage, setPreviewImage] = useState<File | null>(null)

    useEffect(() => {
        if (!admin || !token) return

        getJerseys({ limit: 100 })
            .then((jerseysRes) => {
                setJerseys(jerseysRes.data)
                setLoading(false)
            })
            .catch((err) => {
                toast({ title: "Error", description: "Failed to load data", variant: "destructive" })
                setLoading(false)
            })
    }, [admin, token, toast])

    const handleDesignFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] || null
        if (file && file.size > MAX_DESIGN_FILE_SIZE) {
            toast({
                title: "File Too Large",
                description: "Design file zip cannot be larger than 100MB.",
                variant: "destructive"
            })
            e.target.value = ""
            setDesignFile(null)
            return
        }
        setDesignFile(file)
    }

    const handlePreviewImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] || null
        if (file && file.size > MAX_PREVIEW_IMAGE_SIZE) {
            toast({
                title: "File Too Large",
                description: "Preview image cannot be larger than 10MB.",
                variant: "destructive"
            })
            e.target.value = ""
            setPreviewImage(null)
            return
        }
        setPreviewImage(file)
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value })
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!formData.name || !formData.player || !formData.price || (!formData.image && !previewImage)) {
            toast({ title: "Missing Fields", description: "Please fill in all required fields. You must provide an Image URL or upload a Preview Image." })
            return
        }

        setSubmitting(true)

        if (!token) return

        try {
            if (editingId) {
                const updatedJersey = await updateJerseyAdmin(token, editingId, {
                    name: formData.name,
                    player: formData.player,
                    price: parseFloat(formData.price),
                    originalPrice: formData.originalPrice ? parseFloat(formData.originalPrice) : undefined,
                    image: formData.image,
                    badge: formData.badge || undefined,
                    badgeColor: formData.badgeColor || undefined,
                    designFile: designFile || undefined,
                    previewImage: previewImage || undefined,
                })
                setJerseys(jerseys.map(j => j.id === editingId ? updatedJersey : j))
                toast({ title: "Success", description: "Jersey updated successfully!" })
            } else {
                const newJersey = await createJerseyAdmin(token, {
                    name: formData.name,
                    player: formData.player,
                    price: parseFloat(formData.price),
                    originalPrice: formData.originalPrice ? parseFloat(formData.originalPrice) : undefined,
                    image: formData.image,
                    badge: formData.badge || undefined,
                    badgeColor: formData.badgeColor || undefined,
                    designFile: designFile || undefined,
                    previewImage: previewImage || undefined,
                })
                setJerseys([newJersey, ...jerseys])
                toast({ title: "Success", description: "Jersey created successfully!" })
            }

            setFormData({
                name: "", player: "", price: "", originalPrice: "",
                image: "", badge: "", badgeColor: "",
            })
            setDesignFile(null)
            setPreviewImage(null)
            setShowForm(false)
            setEditingId(null)
        } catch (error: any) {
            toast({ title: "Error", description: error.message || "Failed to create jersey" })
        } finally {
            setSubmitting(false)
        }
    }

    const handleEdit = (jersey: Jersey) => {
        setEditingId(jersey.id)
        setFormData({
            name: jersey.name || "",
            player: jersey.player || "",
            price: jersey.price?.toString() || "",
            originalPrice: jersey.originalPrice?.toString() || "",
            image: jersey.image || "",
            badge: jersey.badge || "",
            badgeColor: jersey.badgeColor || "",

        })
        setShowForm(true)
        window.scrollTo({ top: 0, behavior: "smooth" })
    }

    const handleDelete = async (id: number) => {
        if (!admin || !token) return

        try {
            await deleteJerseyAdmin(token, id)
            setJerseys(jerseys.filter((j) => j.id !== id))
            toast({ title: "Success", description: "Jersey deleted successfully" })
        } catch (error: any) {
            toast({ title: "Error", description: error.message || "Failed to delete jersey", variant: "destructive" })
        }
    }

    const handleLogout = () => {
        localStorage.removeItem("adminUser")
        router.push("/admin")
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-background to-secondary/10 pt-24 pb-12 px-4">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-10">
                    {admin?.role === "SUPERADMIN" && (
                        <Link
                            href="/admin/dashboard"
                            className="inline-flex items-center text-muted-foreground hover:text-foreground mb-4"
                        >
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back to Dashboard
                        </Link>
                    )}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <h1 className="font-[var(--font-oswald)] text-4xl font-bold text-foreground">
                                JERSEYS
                            </h1>
                            {admin?.role === "ADMIN" && (
                                <Button variant="outline" size="sm" onClick={handleLogout} className="text-xs">
                                    Logout
                                </Button>
                            )}
                        </div>
                        <Button onClick={() => {
                            setEditingId(null)
                            setFormData({
                                name: "", player: "", price: "", originalPrice: "",
                                image: "", badge: "", badgeColor: "",
                            })
                            setShowForm(!showForm)
                        }} className="gap-2">
                            <Plus className="h-4 w-4" />
                            Add New Jersey
                        </Button>
                    </div>
                </div>

                {/* Create/Edit Form */}
                {showForm && (
                    <div className="bg-secondary/20 backdrop-blur-xl border border-white/10 shadow-2xl rounded-2xl p-8 mb-12 animate-in fade-in slide-in-from-top-4 duration-300">
                        <h2 className="font-semibold text-lg text-foreground mb-4">
                            {editingId ? "Edit Jersey" : "Create New Jersey"}
                        </h2>
                        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-2">Name *</label>
                                <Input
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="Lakers City Edition"
                                    className="bg-background/50 border-white/10 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-2">Player *</label>
                                <Input
                                    value={formData.player}
                                    onChange={(e) => setFormData({ ...formData, player: e.target.value })}
                                    placeholder="LeBron James #23"
                                    className="bg-background/50 border-white/10 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-2">Price *</label>
                                <Input
                                    type="number"
                                    value={formData.price}
                                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                                    placeholder="999"
                                    className="bg-background/50 border-white/10 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-2">Original Price</label>
                                <Input
                                    type="number"
                                    value={formData.originalPrice}
                                    onChange={(e) => setFormData({ ...formData, originalPrice: e.target.value })}
                                    placeholder="1299"
                                    className="bg-background/50 border-white/10 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-2">Image URL (Fallback)</label>
                                <Input
                                    value={formData.image}
                                    onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                                    placeholder="/jersey-image.png"
                                    className="bg-background/50 border-white/10 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-2">Preview Image (.jpg/.png)</label>
                                <div className="relative">
                                    <input
                                        type="file"
                                        accept="image/jpeg,image/png,image/webp"
                                        onChange={handlePreviewImageChange}
                                        className="w-full h-10 px-3 py-2 rounded-md bg-background/50 border border-white/10 text-foreground text-sm file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 transition-all cursor-pointer"
                                    />
                                    {previewImage && (
                                        <p className="text-xs text-muted-foreground mt-1">
                                            <Upload className="inline h-3 w-3 mr-1" />
                                            {previewImage.name} ({(previewImage.size / 1024 / 1024).toFixed(1)}MB)
                                        </p>
                                    )}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-2">Design File (.zip)</label>
                                <div className="relative">
                                    <input
                                        type="file"
                                        accept=".zip,application/zip,application/x-zip-compressed"
                                        onChange={handleDesignFileChange}
                                        className="w-full h-10 px-3 py-2 rounded-md bg-background/50 border border-white/10 text-foreground text-sm file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 transition-all cursor-pointer"
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
                                <label className="block text-sm font-medium text-foreground mb-2">Badge</label>
                                <Input
                                    value={formData.badge}
                                    onChange={(e) => setFormData({ ...formData, badge: e.target.value })}
                                    placeholder="Best Seller"
                                    className="bg-background/50 border-white/10 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
                                />
                            </div>
                            <div className="md:col-span-2 flex gap-2">
                                <Button type="submit" disabled={submitting}>
                                    {submitting ? "Saving..." : editingId ? "Update Jersey" : "Create Jersey"}
                                </Button>
                                <Button type="button" variant="outline" onClick={() => {
                                    setShowForm(false)
                                    setEditingId(null)
                                }}>
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
                    <div className="text-center py-20 bg-secondary/10 rounded-2xl border border-white/5 border-dashed">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-secondary/30 mb-4">
                            <Shirt className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <h3 className="text-xl font-semibold text-foreground mb-2">No jerseys found</h3>
                        <p className="text-muted-foreground max-w-sm mx-auto">Get started by creating your first premium jersey design to display in your storefront.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                        {jerseys.map((jersey) => (
                            <div key={jersey.id} className="group bg-secondary/20 rounded-2xl overflow-hidden border border-white/5 hover:border-primary/30 hover:-translate-y-2 hover:shadow-2xl hover:shadow-primary/10 transition-all duration-300">
                                <div className="relative aspect-[3/4] overflow-hidden">
                                    <Image
                                        src={jersey.image || "/placeholder.svg"}
                                        alt={jersey.name}
                                        fill
                                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                                    />
                                    {jersey.badge && (
                                        <span className={`absolute top-3 left-3 text-[10px] font-bold tracking-wider uppercase px-3 py-1 rounded-full shadow-lg ${jersey.badgeColor || "bg-gradient-to-r from-primary to-primary/80 text-primary-foreground"}`}>
                                            {jersey.badge}
                                        </span>
                                    )}
                                </div>
                                <div className="p-5">
                                    <h3 className="font-semibold text-foreground text-base line-clamp-1 group-hover:text-primary transition-colors">{jersey.name}</h3>
                                    <p className="text-sm text-muted-foreground mb-3">{jersey.player}</p>
                                    <div className="flex items-center justify-between mt-auto">
                                        <span className="font-[var(--font-oswald)] font-bold text-xl text-foreground">₹{Number(jersey.price).toFixed(0)}</span>
                                    </div>
                                    <div className="flex gap-2 mt-5 pt-4 border-t border-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            className="w-full flex-1 bg-white/5 hover:bg-primary hover:text-primary-foreground transition-colors"
                                            onClick={() => handleEdit(jersey)}
                                        >
                                            <Pencil className="h-4 w-4 mr-2" />
                                            Edit
                                        </Button>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button
                                                    variant="destructive"
                                                    size="sm"
                                                    className="bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-colors"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent className="bg-secondary/40 backdrop-blur-xl border border-white/10">
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Delete this jersey?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        This will permanently delete the jersey "{jersey.name}" and completely remove its zip file and preview image from our servers. This action cannot be undone.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel className="bg-background border-white/10 hover:bg-white/5">Cancel</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleDelete(jersey.id)} className="bg-red-500 hover:bg-red-600 text-white">
                                                        Delete
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
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
