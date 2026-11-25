import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listarMensagensHoje, type MensagemHoje } from '../../services/api'
import { formatarTelefone } from '../../utils/validacao'
import { useErp } from './contexto'

/** A lista se atualiza sozinha a cada minuto (o envio automático confere a cada minuto). */
const ATUALIZAR_MS = 60_000

const SITUACAO: Record<MensagemHoje['situacao'], { rotulo: string; classe: string }> = {
  enviada: { rotulo: '✅ Enviada', classe: 'ok' },
  teste: { rotulo: '🧪 Teste', classe: 'neutra' },
  erro: { rotulo: '⚠️ Não saiu', classe: 'erro' },
  agendada: { rotulo: '⏰ Em aguardo', classe: 'agendada' },
}

/** Horário de hoje; mensagem atrasada (marcada para outro dia, ainda na fila): o dia em que estava marcada. */
const hora = (iso: string) => {
  const data = new Date(iso)
  return data.toDateString() === new Date().toDateString()
    ? data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

/**
 * Mini tela da tela inicial: as mensagens automáticas de hoje (programadas para hoje, enviadas hoje e as atrasadas
 * ainda na fila), uma linha por cliente, em ordem de horário (amanhã a lista recomeça). Clicar no nome abre o cliente.
 */
export default function MensagensHoje() {
  const { sessao } = useErp()
  const [lista, setLista] = useState<MensagemHoje[] | null>(null)
  const [falhou, setFalhou] = useState(false)

  useEffect(() => {
    let ativo = true
    const carregar = () =>
      listarMensagensHoje(sessao.token)
        .then((l) => {
          if (!ativo) return
          setLista(l)
          setFalhou(false)
        })
        .catch(() => ativo && setFalhou(true))
    void carregar()
    const id = window.setInterval(() => void carregar(), ATUALIZAR_MS)
    return () => {
      ativo = false
      window.clearInterval(id)
    }
  }, [sessao.token])

  const conta = (s: MensagemHoje['situacao']) => lista?.filter((m) => m.situacao === s).length ?? 0
  const enviadas = conta('enviada') + conta('teste')
  const agendadas = conta('agendada')
  const erros = conta('erro')
  // Recapitulação ao ligar: as que eram de dias em que o Órion estava fechado
  const atrasadas = lista?.filter((m) => m.atrasada) ?? []
  const atrasadasNaFila = atrasadas.filter((m) => m.situacao === 'agendada').length

  return (
    <section className="mensagens-hoje" aria-labelledby="mensagens-hoje-titulo">
      <header className="mensagens-hoje-topo">
        <h2 id="mensagens-hoje-titulo">
          <img src="/imgs/whatsapp.png" alt="" aria-hidden="true" />
          Mensagens automáticas de hoje
        </h2>
        {lista && lista.length > 0 && (
          <p className="mensagens-hoje-resumo">
            <span>{enviadas} enviadas</span>
            <span>{agendadas} para enviar</span>
            {erros > 0 && <span className="erro">{erros} não saíram</span>}
            {atrasadas.length > 0 && <span className="atrasada">{atrasadas.length} atrasadas</span>}
          </p>
        )}
      </header>

      {atrasadas.length > 0 && (
        <p className="mensagens-hoje-recapitulacao" role="status">
          <span aria-hidden="true">⏱</span>
          {atrasadas.length === 1 ? '1 mensagem ficou' : `${atrasadas.length} mensagens ficaram`} para trás enquanto o
          Órion estava fechado.{' '}
          {atrasadasNaFila > 0
            ? `${atrasadasNaFila === 1 ? 'Ela está saindo' : `${atrasadasNaFila} estão saindo`} agora, uma de cada vez.`
            : 'Já foram enviadas ao ligar.'}
        </p>
      )}

      {!lista && !falhou && <p className="mensagens-hoje-vazio">Carregando...</p>}
      {falhou && !lista && <p className="mensagens-hoje-vazio">Não foi possível carregar as mensagens de hoje.</p>}
      {lista && lista.length === 0 && (
        <p className="mensagens-hoje-vazio">Nenhuma mensagem automática para hoje.</p>
      )}

      {lista && lista.length > 0 && (
        <ul className="mensagens-hoje-lista">
          {lista.map((m, i) => {
            const s = SITUACAO[m.situacao]
            return (
              <li key={`${m.clienteId}-${m.horario}-${i}`} title={m.erro ?? undefined}>
                <time className="mensagens-hoje-hora">{hora(m.horario)}</time>
                <Link to={`/app/clientes/${m.clienteId}`} className="mensagens-hoje-nome">
                  {m.nome}
                  {m.enviadas > 1 && <small> · {m.enviadas} enviadas hoje</small>}
                </Link>
                <span className="mensagens-hoje-celular">{formatarTelefone(m.celular)}</span>
                <span className="mensagens-hoje-fim">
                  {m.atrasada && (
                    <span className="mensagens-hoje-atrasada" title="Era de um dia em que o Órion estava fechado">
                      Atrasada
                    </span>
                  )}
                  <span className={`mensagens-hoje-situacao ${s.classe}`}>{s.rotulo}</span>
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
