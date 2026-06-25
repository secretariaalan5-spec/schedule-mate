# Plano de melhorias do uso diário

Análise focada nos 3 pontos que você levantou + ajustes menores que aparecem no mesmo fluxo.

## 1. Autocomplete da marcação (prioridade alta)

**Hoje:** ao digitar nome no diálogo, a busca espera 400ms, mostra no máximo 10 resultados e fecha ao clicar fora. PSF/SUS/Nascimento usam o mesmo campo de busca, o que confunde. Sem feedback de carregamento inline.

**Melhorias:**
- Reduzir debounce de 400ms → 200ms para resposta mais ágil.
- Buscar a partir de 2 caracteres (hoje busca a cada tecla, gerando ruído).
- Mostrar **idade calculada** (ex: "45 anos") junto do nome — facilita confirmar paciente certo.
- Destacar (highlight) o trecho digitado dentro do nome encontrado.
- Navegação por teclado: ↑ ↓ Enter para escolher sem mouse (acelera muito o uso diário).
- Mostrar até 15 resultados com scroll, ordenados por: nome exato → começa com → contém.
- Indicador visual quando o paciente **já tem consulta no mês** (badge laranja na própria lista, antes de selecionar).
- Reaproveitar a mesma lista para todos os campos (nome, SUS, nascimento, PSF) — uma única dropdown em vez de quatro.

## 2. Calendário — destacar dias com marcações de forma clara

**Hoje:** dias com marcações ficam com um leve tom esverdeado + bolinha — pouco perceptível, principalmente quando há vários dias no mês.

**Melhorias:**
- Aumentar contraste: fundo mais sólido (azul/teal cheio) com texto branco em dias ocupados.
- **Indicador de lotação** por dia: pequena barrinha no rodapé do dia com cor variando por ocupação (verde <50%, amarelo 50–80%, vermelho >80%, cinza-listrado = lotado/sem vagas).
- Tooltip ao passar o mouse: "12/32 vagas ocupadas".
- Dia de hoje com ring distinto mesmo quando não tem marcação.
- Dias passados em cinza claro (visual de "histórico").
- Legenda compacta abaixo do calendário explicando as cores.

## 3. Painel de marcações — visualizar impresso/não impresso

**Hoje:** o ícone verde de "impresso" é um check pequeno ao lado do horário, fácil de não ver. Não dá pra distinguir a linha inteira de relance.

**Melhorias:**
- **Fundo da linha** muda quando impresso: leve verde-claro com borda esquerda verde (3px). Não-impressos ficam com borda esquerda âmbar.
- Badge textual "IMPRESSO" / "PENDENTE" no canto direito da linha, com cor.
- Cabeçalho do painel mostra contadores: "✓ 8 impressos · ⏳ 4 pendentes · 20 livres".
- Filtro de status (já existe) ganha botão de atalho rápido no cabeçalho ("Ver pendentes").
- Ordem visual de hierarquia na linha: **Nome (grande) → PSF · Horário · Tipo → status**. Hoje tudo concorre em tamanho parecido.
- Tipo "RETORNO" com cor diferente de "NORMAL" também na borda (azul vs roxo, por exemplo).
- Densidade ajustável: botão compacto/confortável (algumas funcionárias preferem ver mais de uma vez na tela).

## 4. Quick wins extras que aparecem no fluxo (opcional)

- **Atalho Ctrl/Cmd+K:** abrir busca de paciente de qualquer tela.
- **Setas ← → no calendário:** trocar de dia rapidamente.
- **Imprimir todos pendentes** com 1 clique no topo do painel.
- **Última marcação do paciente** mostrada no autocomplete (data + PSF) para evitar repetir.

## Sugestão de execução

Sugiro fazer em 2 entregas:

**Entrega 1 (impacto imediato no dia a dia):**
- Autocomplete melhorado (item 1)
- Destaque visual de impresso/pendente no painel (item 3)
- Calendário com cores de lotação (item 2)

**Entrega 2 (refinos):**
- Atalhos de teclado + densidade ajustável + ações em lote (item 4)

Me confirma se posso começar pela **Entrega 1** ou se quer ajustar a ordem / tirar algum item.
