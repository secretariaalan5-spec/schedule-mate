

# Sugestões de melhoria do sistema

Antes de novas funcionalidades, há **erros de build ativos** que precisam ser corrigidos — o sistema pode estar rodando com versão antiga em cache. Depois disso, sugiro melhorias de qualidade, performance e usabilidade.

## 1. Correções urgentes (erros de build atuais)

Sem essas correções, qualquer próximo deploy pode quebrar:

- **`AppointmentDialog.tsx`**: `slot` e `date` declarados duas vezes na interface `Props`.
- **`SlotPanel.tsx`**: `title: string` declarado duas vezes na interface `Props`.
- **`PatientManager.tsx` (linha 47)**: `onUpdate(editPatient.id, data)` precisa virar `onUpdate({ id: editPatient.id, updates: data })`.
- **`Dashboard.tsx` (linhas 38 e 221)**: `sched.fetchAppointments(date)` chamado com argumento, mas a função não aceita parâmetro.
- **`useShifts.ts`**: a tabela `scheduling_shifts` existe no banco mas **não está nos types do Supabase** (`src/integrations/supabase/types.ts`). Solução: regenerar os types do Supabase para incluir a tabela.

## 2. Melhorias de segurança e dados

- **Sistema de papéis (admin/usuário)**: hoje qualquer usuário autenticado pode deletar pacientes, marcações e até unidades de saúde. Criar tabela `user_roles` + função `has_role()` e restringir ações destrutivas a `admin`.
- **Soft delete para pacientes**: trocar `DELETE` por uma flag `deleted_at`, evitando perda acidental de histórico clínico.
- **Auditoria mínima**: tabela `audit_log` registrando quem criou/editou/excluiu marcações (importante em ambiente de saúde).
- **Validação de duplicatas no cadastro**: impedir client-side a criação de paciente com nome igual antes de bater no banco (hoje só o índice único barra, gerando erro genérico).

## 3. Melhorias de funcionalidade

- **Filtros na agenda**: filtrar marcações por PSF, tipo (NORMAL/RETORNO) ou status (impresso/não-impresso).
- **Busca global**: buscar paciente direto da agenda (atalho de teclado) sem trocar de aba.
- **Relatório mensal em Excel**: exportar todas as marcações do mês com totais por PSF, por tipo e por dia.
- **Indicador de "faltas"**: marcar paciente que não compareceu, gerando estatística por paciente no histórico.
- **Lista de espera**: quando todas as vagas do dia estão ocupadas, permitir adicionar paciente em fila e notificar quando vaga abrir.
- **Histórico do paciente exportável**: botão para imprimir/exportar o histórico completo de consultas dentro do diálogo de histórico.

## 4. Performance

- **Paginação real na lista de pacientes**: hoje carrega até 1000 registros de uma vez. Usar paginação por cursor (`range()`) ou virtualização (`@tanstack/react-virtual`).
- **Índices no banco**: garantir índices em `appointments(date)`, `appointments(patient_id)` e `patients(sus_card)` para queries mais rápidas.
- **Memoizar derivações pesadas** no `Dashboard.tsx` (cálculos de `morningFree`/`afternoonFree` reexecutam a cada render).

## 5. UX e qualidade

- **Confirmação visual padronizada**: substituir `window.confirm()` por `AlertDialog` do shadcn (visual consistente, melhor em mobile).
- **Loading skeleton** na lista de pacientes em vez de "Carregando...".
- **Toast de sucesso ao exportar Excel** com link "Abrir arquivo".
- **Atalhos de teclado**: `Ctrl+K` para busca, setas para navegar entre dias.
- **Modo escuro**: toggle no header (já há suporte parcial via Tailwind).

## 6. Manutenibilidade

- **Configurar CI** com checagem de TypeScript no PR (evitaria os erros atuais chegarem ao main).
- **Testes para fluxos críticos**: já há `playwright.config.ts` e `vitest.config.ts` configurados, mas só um teste de exemplo. Adicionar testes para: criar marcação, editar marcação, busca de paciente.
- **Limpar imports não usados** e código duplicado nos componentes (vários re-renders desnecessários).

---

## Como proceder

Posso seguir em qualquer combinação dessas frentes. Recomendo esta ordem:

1. **Corrigir os erros de build** (rápido, destrava o sistema).
2. **Sistema de papéis + soft delete** (segurança crítica em saúde).
3. **Paginação + filtros na agenda** (ganho de performance e usabilidade imediato).
4. Demais melhorias conforme prioridade.

Me diga **quais itens você quer que eu implemente agora** (ex: "1 e 2", "só corrigir os erros", "tudo da seção 3") e eu sigo na sequência.

