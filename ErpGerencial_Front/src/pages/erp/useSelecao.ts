import { useState } from 'react'

/** Linhas marcadas numa lista (caixinhas de marcar), para excluir de uma vez. */
export function useSelecao() {
  const [marcados, setMarcados] = useState<ReadonlySet<string>>(new Set())

  const alternar = (id: string) =>
    setMarcados((atual) => {
      const novo = new Set(atual)
      if (novo.has(id)) novo.delete(id)
      else novo.add(id)
      return novo
    })

  /** Caixinha do cabeçalho: marca ou desmarca todas as linhas da página. */
  const todos = (ids: string[], marcar: boolean) => setMarcados(marcar ? new Set(ids) : new Set())

  const limpar = () => setMarcados(new Set())

  return { marcados, alternar, todos, limpar }
}
