/** Generate a UUID v4 using Web Crypto */
export function uuidv4(): string {
  return crypto.randomUUID()
}

