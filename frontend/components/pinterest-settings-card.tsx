"use client"

import { useEffect, useState } from "react"
import { Share2, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/use-toast"
import {
    getPinterestStatus,
    setPinterestExportBoard,
    downloadPinterestCsv,
    PinterestStatus,
} from "@/lib/api"

function errorMessage(err: unknown, fallback: string): string {
    return err instanceof Error ? err.message : fallback
}

export function PinterestSettingsCard({ token }: { token: string | null }) {
    const { toast } = useToast()
    const [status, setStatus] = useState<PinterestStatus | null>(null)
    const [boardName, setBoardName] = useState("")
    const [loading, setLoading] = useState(true)
    const [busy, setBusy] = useState(false)

    const loadStatus = async () => {
        if (!token) return
        try {
            const s = await getPinterestStatus(token)
            setStatus(s)
            if (s.exportBoardName) setBoardName(s.exportBoardName)
        } catch (err) {
            console.error("Failed to load Pinterest status:", err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadStatus()
    }, [token])

    const handleSaveBoard = async () => {
        if (!token || !boardName.trim()) return
        setBusy(true)
        try {
            await setPinterestExportBoard(token, boardName.trim())
            toast({ title: "Saved", description: "Exports will use this board name." })
            await loadStatus()
        } catch (err) {
            toast({ title: "Error", description: errorMessage(err, "Failed to save board name"), variant: "destructive" })
        } finally {
            setBusy(false)
        }
    }

    const handleDownload = async (includeExported: boolean) => {
        if (!token) return
        setBusy(true)
        try {
            const { exportedCount, skippedCount } = await downloadPinterestCsv(token, includeExported)
            const skippedNote = skippedCount > 0
                ? ` ${skippedCount} jersey${skippedCount === 1 ? "" : "s"} skipped (unsupported image format — needs jpg/png).`
                : ""
            toast({
                title: "Downloaded",
                description: `${exportedCount} pin${exportedCount === 1 ? "" : "s"} in the file.${skippedNote} Upload it at Pinterest → Settings → Import content.`,
            })
            await loadStatus()
        } catch (err) {
            toast({ title: "Error", description: errorMessage(err, "Failed to download CSV"), variant: "destructive" })
        } finally {
            setBusy(false)
        }
    }

    if (loading) {
        return <div className="bg-secondary/30 rounded-xl p-6 animate-pulse h-24" />
    }

    return (
        <div className="bg-secondary/30 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 rounded-lg bg-red-500/10">
                        <Share2 className="h-6 w-6 text-red-500" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-foreground">Pinterest Export</h3>
                        <p className="text-sm text-muted-foreground">
                            Download a CSV of new jersey designs to bulk-upload on Pinterest.
                        </p>
                    </div>
                </div>
                <Badge variant="secondary">{status?.pendingExportCount ?? 0} pending</Badge>
            </div>

            <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                    <Input
                        value={boardName}
                        onChange={(e) => setBoardName(e.target.value)}
                        placeholder="Exact Pinterest board name"
                        className="max-w-xs"
                    />
                    <Button variant="outline" size="sm" onClick={handleSaveBoard} disabled={busy || !boardName.trim()}>
                        Save board name
                    </Button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <Button
                        onClick={() => handleDownload(false)}
                        disabled={busy || !status?.exportBoardName || !status?.pendingExportCount}
                        className="gap-2"
                    >
                        <Download className="h-4 w-4" />
                        Download CSV ({status?.pendingExportCount ?? 0} new)
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownload(true)}
                        disabled={busy || !status?.exportBoardName}
                    >
                        Redownload all
                    </Button>
                </div>

                <p className="text-xs text-muted-foreground">
                    Upload the file at Pinterest &rarr; Settings &rarr; Import content. Each download marks those
                    jerseys as exported, so the next one only includes new designs — use &quot;Redownload all&quot;
                    to redo a failed upload.
                </p>
            </div>
        </div>
    )
}
