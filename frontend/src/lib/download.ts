/**
 * Saves a file the app has downloaded, under the given name, the same way a
 * click on a download link would. The temporary URL is released once the
 * browser has taken the click.
 */
export function saveFile(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.hidden = true
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
