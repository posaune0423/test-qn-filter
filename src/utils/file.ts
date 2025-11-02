/**
 * File utility functions
 */

/**
 * Read filter function from file
 *
 * @param filePath - Path to the filter function file
 * @returns Promise resolving to the file contents
 */
export async function readFilterFile(filePath: string): Promise<string> {
  const file = Bun.file(filePath);
  if (!(await file.exists())) {
    throw new Error(`Filter file not found: ${filePath}`);
  }
  return await file.text();
}
