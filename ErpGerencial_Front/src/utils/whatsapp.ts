/**
 * Endereço que abre a conversa com o número no WhatsApp (Web ou aplicativo), para mandar a mensagem por conta própria.
 * Celular com DDD (10 ou 11 dígitos) ganha o código do Brasil; número incompleto → null (sem link).
 */
export function linkWhatsapp(celular: string | null | undefined): string | null {
  const digitos = (celular ?? '').replace(/\D/g, '')
  if (digitos.length === 10 || digitos.length === 11) return `https://wa.me/55${digitos}`
  if (digitos.length >= 12 && digitos.length <= 13 && digitos.startsWith('55')) return `https://wa.me/${digitos}`
  return null
}
