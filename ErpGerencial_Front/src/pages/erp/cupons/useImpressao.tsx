import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/**
 * Impressão do cupom ou do orçamento: `imprimir()` abre a janela de impressão já no tamanho do papel — bobina de
 * 80 mm (impressora térmica) ou folha A4. Só o documento sai no papel (o resto da página fica escondido). Coloque
 * `elemento` em qualquer lugar da página. `documento` é o que vai no papel (ex.: <CupomTermico />); null enquanto
 * não carregou.
 */
export function useImpressao(documento: ReactNode, papel: 'bobina' | 'a4' = 'bobina') {
  const [imprimindo, setImprimindo] = useState(false)

  useEffect(() => {
    if (!imprimindo) return
    const pagina = document.createElement('style')
    if (papel === 'a4') pagina.textContent = '@page { size: A4; margin: 10mm; }'
    else {
      // A bobina de 80 mm não tem altura fixa: o papel fica do tamanho do cupom (medido já montado, fora da tela)
      const altura = document.querySelector<HTMLElement>('.impressao-cupom .ct')?.offsetHeight ?? 0
      const alturaMm = Math.ceil((altura * 25.4) / 96) + 6
      pagina.textContent = `@page { size: 80mm ${Math.max(alturaMm, 60)}mm; margin: 0; }`
    }
    document.head.appendChild(pagina)
    document.body.classList.add('imprimindo')
    const terminar = () => setImprimindo(false)
    window.addEventListener('afterprint', terminar)
    // Espera o cupom aparecer na página antes de abrir a janela de impressão
    const timer = window.setTimeout(() => window.print(), 50)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('afterprint', terminar)
      pagina.remove()
      document.body.classList.remove('imprimindo')
    }
  }, [imprimindo, papel])

  const elemento =
    documento && imprimindo
      ? createPortal(<div className="impressao impressao-cupom">{documento}</div>, document.body)
      : null

  return { imprimir: () => setImprimindo(true), imprimindo, elemento }
}
