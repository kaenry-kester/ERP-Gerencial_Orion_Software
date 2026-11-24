import { useEffect, useState } from 'react'
import { Link, Navigate, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useSessaoExpirada } from '../../hooks/useSessaoExpirada'
import {
  expiracaoDoToken,
  fecharSistema,
  lerSessao,
  mensagemDe,
  podeFecharSistema,
  renovarSessao,
  sair,
  salvarSessao,
  sessaoAtual,
  type Sessao,
} from '../../services/api'
import type { ContextoErp } from './contexto'
import JanelaSair from './JanelaSair'
import { caminhoDo, podeAcessar, PREFERENCIAS } from './modulos'
import './erp.css'

/*
  Estrutura do ERP (depois do login):
  - header: logo Órion (volta ao início) e os links Minha conta,
    Empresa, Usuários (administrador) e Sair (no computador da loja, pode fechar o Órion inteiro);
  - conteúdo: a tela inicial com os botões grandes ou a página do módulo aberto.
*/
export default function ErpLayout() {
  const navigate = useNavigate()
  const sessaoExpirada = useSessaoExpirada()
  const [sessao, setSessao] = useState(lerSessao)
  // "Sair" no computador da loja: pode fechar o Órion inteiro (sistema, WhatsApp e banco)
  const [podeFechar, setPodeFechar] = useState(false)
  const [janelaSair, setJanelaSair] = useState(false)
  const [fechando, setFechando] = useState(false)
  const [erroFechar, setErroFechar] = useState<string | null>(null)
  const [fechado, setFechado] = useState(false)

  const atualizarSessao = (nova: Sessao) => {
    salvarSessao(nova)
    setSessao(nova)
  }

  // Atualiza permissões e empresa com o servidor (o administrador pode ter mudado algo).
  useEffect(() => {
    if (!sessao) return
    let ativo = true
    sessaoAtual(sessao.token)
      .then((atual) => {
        if (!ativo) return
        salvarSessao(atual)
        setSessao(atual)
      })
      // Sem conexão: continua com os dados guardados; sessão vencida ou desativada: volta ao login.
      .catch((erro) => ativo && sessaoExpirada(erro))
    return () => {
      ativo = false
    }
    // Só ao abrir o ERP (e a cada novo login); sessaoExpirada muda a cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessao?.token])

  // Sessão renovada sozinha enquanto o sistema está aberto (o token vale 8 horas): quando faltam menos de 4 horas,
  // pede um novo — a cada 15 minutos e ao voltar para a aba (ex.: depois do computador dormir).
  useEffect(() => {
    if (!sessao) return
    const token = sessao.token
    const renovarSePreciso = () => {
      const vence = expiracaoDoToken(token)
      if (vence && vence - Date.now() < 4 * 60 * 60 * 1000 && vence > Date.now())
        renovarSessao(token)
          .then((nova) => {
            salvarSessao(nova)
            setSessao(nova)
          })
          .catch(() => {}) // vencida ou sem conexão: a próxima chamada leva ao login
    }
    renovarSePreciso()
    const id = window.setInterval(renovarSePreciso, 15 * 60 * 1000)
    window.addEventListener('focus', renovarSePreciso)
    return () => {
      window.clearInterval(id)
      window.removeEventListener('focus', renovarSePreciso)
    }
  }, [sessao?.token]) // eslint-disable-line react-hooks/exhaustive-deps

  // Programa da loja aberto no próprio computador: o "Sair" oferece fechar tudo
  useEffect(() => {
    if (!sessao) return
    let ativo = true
    podeFecharSistema(sessao.token)
      .then((r) => ativo && setPodeFechar(r.podeFechar))
      .catch(() => {})
    return () => {
      ativo = false
    }
  }, [sessao?.token]) // eslint-disable-line react-hooks/exhaustive-deps

  if (fechado) {
    return (
      <div className="erp-fechado" role="status">
        <img src="/imgs/logo-orion.png" alt="Órion" />
        <h1>O Órion foi fechado</h1>
        <p>A cópia de segurança foi feita e tudo foi fechado. Seus dados estão salvos.</p>
        <p>Já pode fechar esta janela. Para abrir de novo, use o atalho “Órion” da Área de Trabalho.</p>
      </div>
    )
  }

  if (!sessao) return <Navigate to="/login" replace />

  const contexto: ContextoErp = { sessao, atualizarSessao }

  const sairDaConta = () => {
    sair()
    navigate('/', { replace: true })
  }

  const fecharTudo = async () => {
    setFechando(true)
    setErroFechar(null)
    try {
      await fecharSistema(sessao.token)
      sair()
      setFechado(true)
      window.close() // só funciona em janelas abertas pelo próprio Órion; senão fica a mensagem
    } catch (erro) {
      setErroFechar(`Não foi possível fechar: ${mensagemDe(erro)}. Use o "Parar Orion" da pasta do programa.`)
      setFechando(false)
    }
  }

  return (
    <div className="erp">
      <header className="erp-header">
        <Link to="/app" className="erp-logo-link" aria-label="Órion — início">
          <img src="/imgs/logo-orion.png" alt="Órion" className="erp-logo" />
        </Link>

        <div className="erp-header-conta">
          <nav className="erp-header-botoes" aria-label="Preferências">
            {PREFERENCIAS.filter((m) => podeAcessar(sessao.usuario, m)).map((m) => (
              <NavLink
                key={m.id}
                to={caminhoDo(m)}
                title={m.rotulo}
                className={({ isActive }) => (isActive ? 'erp-header-botao ativo' : 'erp-header-botao')}
              >
                {m.rotuloCurto ? (
                  <>
                    <span className="erp-header-longo">{m.rotuloBotao ?? m.rotulo}</span>
                    <span className="erp-header-curto">{m.rotuloCurto}</span>
                  </>
                ) : (
                  (m.rotuloBotao ?? m.rotulo)
                )}
              </NavLink>
            ))}
            <button
              type="button"
              className="erp-header-botao"
              onClick={() => (podeFechar ? setJanelaSair(true) : sairDaConta())}
            >
              Sair
            </button>
          </nav>
        </div>
      </header>

      <main className="erp-conteudo">
        <Outlet context={contexto} />
      </main>

      <JanelaSair
        aberto={janelaSair}
        fechando={fechando}
        erro={erroFechar}
        onFecharTudo={() => void fecharTudo()}
        onSoSair={sairDaConta}
        onCancelar={() => setJanelaSair(false)}
      />
    </div>
  )
}
