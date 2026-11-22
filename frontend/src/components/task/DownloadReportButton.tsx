import { useMutation } from '@tanstack/react-query'
import { FileDown, LoaderCircle } from 'lucide-react'
import { toast } from 'sonner'

import { downloadReport } from '@/api/reports'
import { Button } from '@/components/ui/button'

/**
 * UC-18: saves the task's verification report as a Markdown file. It changes
 * nothing, so it works on every status, without an "Acting as" name, and while
 * other changes save.
 */
export function DownloadReportButton({ taskId }: { taskId: string }) {
  const download = useMutation({ mutationFn: () => downloadReport(taskId) })

  function onDownload() {
    download.mutate(undefined, {
      onSuccess: (fileName) => {
        toast.success('Report downloaded', { description: fileName })
      },
      onError: (error) => {
        toast.error('Could not download the report', { description: error.message })
      },
    })
  }

  return (
    <Button variant="outline" size="sm" onClick={onDownload} disabled={download.isPending}>
      {download.isPending ? (
        <LoaderCircle aria-hidden="true" className="animate-spin" />
      ) : (
        <FileDown aria-hidden="true" />
      )}
      Download report
    </Button>
  )
}
