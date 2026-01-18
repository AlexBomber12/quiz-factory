Estilo de Decisão: Análise vs Intuição (PT-BR)
=============================================

Propósito
---------
Um teste rápido de autoconhecimento para Quiz Factory que mapeia como você toma decisões: análise vs intuição, velocidade vs precisão e seu apetite por risco.

Não negociáveis
---------------
- Usar IDs estáveis para tudo o que é usado em scoring ou analítica.
- Localizar apenas textos visíveis, não IDs.
- Não armazenar respostas brutas em analítica ou banco de dados.
- Evitar respostas de texto livre no MVP.
- Evitar coletar PII.
- Evitar alegações de diagnóstico médico.

Metadados internos
-----------------
test_id: decision_style_analytical_intuitive_v1
slug: decision-style-analytical-intuitive
version: 1.0.0
category: decision-making
format_id: universal_human_v1
primary_locale: pt-BR
supported_locales: pt-BR
estimated_time_min: 5
estimated_time_max: 7
questions_count: 22

Aviso ao usuário
----------------
Isto é uma ferramenta de autoexploração e entretenimento. Não é um diagnóstico médico, psicológico, jurídico ou financeiro.

Conceito
--------
Conceito em 1 parágrafo:
Suas melhores decisões quase sempre nascem da mistura certa entre pensar e sentir. Este teste mostra qual é a sua mistura padrão, quão rápido você se compromete e quanta incerteza você tolera. A ideia não é te rotular como "bom" ou "ruim". É te ajudar a enxergar seus hábitos de decisão, em quais situações eles brilham e em quais momentos um ajuste pequeno poupa tempo, dinheiro e arrependimento.

O que mede (1 linha):
Estilo de decisão (Analítico vs Intuitivo), ritmo (Velocidade vs Precisão) e apetite por risco.

Promessa curta:
Em 22 afirmações rápidas, você recebe seu perfil de decisão e um jeito prático de ajustar velocidade, precisão e risco de acordo com o que está em jogo.

Texto de UI (tela inicial)
--------------------------
Locale: pt-BR
Title: Estilo de Decisão: Análise vs Intuição
Short description: Descubra como você decide na incerteza: cabeça vs instinto, rápido vs cuidadoso, seguro vs ousado.
Intro: 22 afirmações. Sem pegadinha. Responda como você decide de verdade, especialmente quando está correndo ou sob pressão.
Instructions: Escolha a opção que mais combina com você na maior parte do tempo. Se ficar em dúvida entre 2, pegue a que você faz um pouco mais.

Escalas de resposta (reutilizáveis)
----------------------------------
Scale: likert_5
- option_id: likert_1, score: 1
  labels:
    pt-BR: Discordo totalmente
- option_id: likert_2, score: 2
  labels:
    pt-BR: Discordo
- option_id: likert_3, score: 3
  labels:
    pt-BR: Nem discordo nem concordo
- option_id: likert_4, score: 4
  labels:
    pt-BR: Concordo
- option_id: likert_5, score: 5
  labels:
    pt-BR: Concordo totalmente

Banco de perguntas (human-readable)
----------------------------------
QID: q01
Type: likert_5
Required: true
Scale: likert_5
Prompt:
- pt-BR: Eu fico desconfortável em decidir sem pelo menos alguns fatos concretos.
Scoring weights (per scale_id):
  analysis: 2
  precision: 1

QID: q02
Type: likert_5
Required: true
Scale: likert_5
Prompt:
- pt-BR: Quando os dados estão confusos, eu confio mais na intuição do que em planilhas.
Scoring weights (per scale_id):
  intuition: 2

QID: q03
Type: likert_5
Required: true
Scale: likert_5
Prompt:
- pt-BR: Prefiro decidir rápido e ajustar depois do que esperar certeza total.
Scoring weights (per scale_id):
  speed: 2
  risk: 1

QID: q04
Type: likert_5
Required: true
Scale: likert_5
Prompt:
- pt-BR: Eu naturalmente quebro escolhas grandes em critérios e dou peso a cada um.
Scoring weights (per scale_id):
  analysis: 2

QID: q05
Type: likert_5
Required: true
Scale: likert_5
Prompt:
- pt-BR: Eu percebo o "clima" (tom, timing, sinais sutis) e isso influencia minhas decisões.
Scoring weights (per scale_id):
  intuition: 2

QID: q06
Type: likert_5
Required: true
Scale: likert_5
Prompt:
- pt-BR: Eu confiro detalhes 2 vezes, porque erros pequenos me incomodam depois.
Scoring weights (per scale_id):
  precision: 2

QID: q07
Type: likert_5
Required: true
Scale: likert_5
Prompt:
- pt-BR: Eu consigo decidir bem com 70% da informação.
Scoring weights (per scale_id):
  speed: 2
  risk: 1

QID: q08
Type: likert_5
Required: true
Scale: likert_5
Prompt:
- pt-BR: Eu gosto de usar modelos simples (prós e contras, pontuação, valor esperado) para escolher.
Scoring weights (per scale_id):
  analysis: 2

QID: q09
Type: likert_5
Required: true
Scale: likert_5
Prompt:
- pt-BR: Se minha primeira intuição é forte, eu geralmente ajo.
Scoring weights (per scale_id):
  intuition: 2
  speed: 1

QID: q10
Type: likert_5
Required: true
Scale: likert_5
Prompt:
- pt-BR: Antes de escolher, eu imagino 2-3 jeitos de dar errado.
Scoring weights (per scale_id):
  precision: 2
  analysis: 1

QID: q11
Type: likert_5
Required: true
Scale: likert_5
Prompt:
- pt-BR: Prefiro fazer um teste pequeno a ficar debatendo sem fim.
Scoring weights (per scale_id):
  speed: 2
  analysis: 1

QID: q12
Type: likert_5
Required: true
Scale: likert_5
Prompt:
- pt-BR: Para mim, acertar importa mais do que ser rápido.
Scoring weights (per scale_id):
  precision: 2

QID: q13
Type: likert_5
Required: true
Scale: likert_5
Prompt:
- pt-BR: Eu me sinto confortável assumindo um risco calculado se o ganho potencial for grande.
Scoring weights (per scale_id):
  risk: 1
  analysis: 1

QID: q14
Type: likert_5
Required: true
Scale: likert_5
Prompt:
- pt-BR: Se aparece uma evidência nova, eu mudo de ideia rápido.
Scoring weights (per scale_id):
  analysis: 1
  speed: 1

QID: q15
Type: likert_5
Required: true
Scale: likert_5
Prompt:
- pt-BR: Eu peço uma segunda opinião para pegar pontos cegos.
Scoring weights (per scale_id):
  precision: 1

QID: q16
Type: likert_5
Required: true
Scale: likert_5
Prompt:
- pt-BR: Eu confio em padrões da experiência mesmo sem conseguir explicar bem.
Scoring weights (per scale_id):
  intuition: 2

QID: q17
Type: likert_5
Required: true
Scale: likert_5
Prompt:
- pt-BR: Com pressão de tempo, eu fico calmo e ainda assim decido.
Scoring weights (per scale_id):
  speed: 2
  risk: 1

QID: q18
Type: likert_5
Required: true
Scale: likert_5
Prompt:
- pt-BR: Eu consigo conviver com a incerteza sem correr para "fechar" a decisão.
Scoring weights (per scale_id):
  precision: 2

QID: q19
Type: likert_5
Required: true
Scale: likert_5
Prompt:
- pt-BR: Números e previsões me influenciam mais do que histórias e anedotas.
Scoring weights (per scale_id):
  analysis: 2

QID: q20
Type: likert_5
Required: true
Scale: likert_5
Prompt:
- pt-BR: Eu uso regras de bolso (atalhos) para decidir rápido.
Scoring weights (per scale_id):
  speed: 2
  intuition: 1

QID: q21
Type: likert_5
Required: true
Scale: likert_5
Prompt:
- pt-BR: Eu não gosto de escolher sem uma definição clara de sucesso.
Scoring weights (per scale_id):
  analysis: 2
  precision: 1

QID: q22
Type: likert_5
Required: true
Scale: likert_5
Prompt:
- pt-BR: Eu tendo a escolher a opção mais ousada em vez da mais segura.
Scoring weights (per scale_id):
  risk: 1
  speed: 1

Modelo de pontuação
-------------------
Model C: Híbrido (multi-escala + perfil determinístico)

1) Calcular scale_scores
- scale_scores[scale_id] = soma(option_score * peso) em todas as perguntas.

Scale IDs usados no scoring:
- analysis
- intuition
- speed
- precision
- risk

2) Calcular eixos (determinístico)
- style_axis = scale_scores[analysis] - scale_scores[intuition]
- pace_axis = scale_scores[speed] - scale_scores[precision]

3) "Inclinação" de risco (derivada do score de risco)
- risk_score = scale_scores[risk]
- risk_cautious: 5-12 (inclusive)
- risk_balanced: 13-18 (inclusive)
- risk_bold: 19-25 (inclusive)

4) band_id do perfil (4 perfis)
- strategist: style_axis >= 0 AND pace_axis < 0
- rapid_analyst: style_axis >= 0 AND pace_axis >= 0
- reflective_visionary: style_axis < 0 AND pace_axis < 0
- instinct_sprinter: style_axis < 0 AND pace_axis >= 0

5) top_traits (3 IDs, determinístico)
- dominant_style_trait = analysis se scale_scores[analysis] >= scale_scores[intuition], senão intuition
- dominant_pace_trait = speed se scale_scores[speed] >= scale_scores[precision], senão precision
- risk_tilt_trait = um de: risk_cautious | risk_balanced | risk_bold
- top_traits = [dominant_style_trait, dominant_pace_trait, risk_tilt_trait]

Escalas
-------
- scale_id: analysis
  Display name:
    pt-BR: Analítico
  Definition:
    pt-BR: Você prefere fatos, estrutura e trade-offs explícitos. Você se sente mais seguro quando o raciocínio está visível.

- scale_id: intuition
  Display name:
    pt-BR: Intuitivo
  Definition:
    pt-BR: Você confia em reconhecimento de padrões e contexto. Você capta sinais que outros não veem, mesmo que seja difícil explicar.

- scale_id: speed
  Display name:
    pt-BR: Velocidade
  Definition:
    pt-BR: Você se move rápido, decide com informação imperfeita e ajusta no caminho.

- scale_id: precision
  Display name:
    pt-BR: Precisão
  Definition:
    pt-BR: Você desacelera, confere detalhes e otimiza para acertar. Você prefere menos erro a fechar rápido.

- scale_id: risk
  Display name:
    pt-BR: Apetite por risco
  Definition:
    pt-BR: Seu conforto com incerteza e possível perda. Scores mais altos indicam mais disposição a apostar por upside.

Traços derivados (para TOP3)
----------------------------
- trait_id: risk_cautious
  Display name:
    pt-BR: Prudente
  Definition:
    pt-BR: Você tende a escolher opções mais seguras e prefere proteger o lado negativo.

- trait_id: risk_balanced
  Display name:
    pt-BR: Equilibrado
  Definition:
    pt-BR: Você assume riscos quando vale a pena, mas não corre atrás de risco por esporte.

- trait_id: risk_bold
  Display name:
    pt-BR: Ousado
  Definition:
    pt-BR: Você se sente confortável com apostas maiores e ambiguidade, especialmente quando o upside é claro.

Perfis (bands)
--------------
- band_id: strategist
  Display name:
    pt-BR: Estrategista
  One-liner:
    pt-BR: Analítico + Precisão. Você vence deixando a decisão "limpa" e depois executando com confiança.

- band_id: rapid_analyst
  Display name:
    pt-BR: Analista Ágil
  One-liner:
    pt-BR: Analítico + Velocidade. Você vence se movendo rápido com um framework e aprendendo por iteração.

- band_id: reflective_visionary
  Display name:
    pt-BR: Visionário Reflexivo
  One-liner:
    pt-BR: Intuitivo + Precisão. Você vence percebendo padrões com profundidade e testando antes de se comprometer.

- band_id: instinct_sprinter
  Display name:
    pt-BR: Sprinter Instintivo
  One-liner:
    pt-BR: Intuitivo + Velocidade. Você vence confiando cedo no sinal e transformando decisão em ação rapidamente.

Regras de desempate
-------------------
Rule 1: Se style_axis == 0, escolher Analítico (style_axis >= 0).
Rule 2: Se pace_axis == 0, escolher Velocidade (pace_axis >= 0).
Rule 3: Se risk_score cair exatamente na fronteira, usar os intervalos inclusivos acima (prudente max 12, equilibrado max 18).

Política de respostas faltantes
-------------------------------
Todas as perguntas são obrigatórias. Se faltar alguma resposta, bloquear a conclusão e pedir para responder os itens restantes.

Payload de resultado derivado (salvar só isto)
----------------------------------------------
Não salvar respostas brutas. Salvar apenas resultados derivados.

Required fields:
- test_id
- computed_at_utc
- derived:
  - scale_scores: { analysis, intuition, speed, precision, risk }
  - band_id: um de { strategist, rapid_analyst, reflective_visionary, instinct_sprinter }
  - top_traits: [dominant_style_trait, dominant_pace_trait, risk_tilt_trait]
  - flags: lista opcional
  - meta: objeto opcional (apenas agregados seguros)

Derived extras recomendados (ainda seguro):
- derived.meta.style_axis
- derived.meta.pace_axis
- derived.meta.risk_score

Bibliotecas de copy
-------------------
Preview copy library (free)

Key: strategist
- pt-BR: Você decide como Estrategista: desacelera para acertar e depois se compromete. Seu superpoder é clareza; seu risco é montar um caso perfeito quando uma jogada menor já resolvia.

Key: rapid_analyst
- pt-BR: Você é Analista Ágil: pensa com estrutura, mas não fica travado. Seu superpoder é momentum; seu risco é deixar passar o detalhe que mudaria o resultado.

Key: reflective_visionary
- pt-BR: Você é Visionário Reflexivo: confia nos padrões e depois faz um sanity-check antes de se comprometer. Seu superpoder é profundidade; seu risco é manter a decisão aberta tempo demais.

Key: instinct_sprinter
- pt-BR: Você é Sprinter Instintivo: decide rápido e aprende fazendo. Seu superpoder é velocidade; seu risco é apostar no primeiro sinal em vez do melhor.

Paid copy library (full)

Key: strategist
pt-BR bullets:
- Seu "funil de decisão" (o que vem primeiro, segundo, terceiro) e como cortar tempo sem cortar qualidade.
- As 3 armadilhas que te deixam lento, com contra-movimentos que funcionam para você.
- Um dial de risco pessoal: quando jogar seguro, quando pressionar, e como criar guardrails.

Key: rapid_analyst
pt-BR bullets:
- Como manter velocidade sem virar correria (seus 2 checks mais fortes).
- Onde você tende a subestimar risco e como notar cedo.
- 5 scripts de decisão para apostas altas, reuniões e negociações.

Key: reflective_visionary
pt-BR bullets:
- Como traduzir intuição em raciocínio claro (para os outros confiarem nas suas decisões).
- Onde o perfeccionismo vira "só mais uma volta" e como fechar bem.
- Mapa de risco: quais apostas valem para você e quais é melhor delegar ou proteger.

Key: instinct_sprinter
pt-BR bullets:
- Como melhorar decisões no instinto com 2 checagens rápidas (sem perder ritmo).
- Em quais situações você ganha grande e onde seu estilo pode virar contra você.
- Um plano prático para reduzir arrependimento mantendo sua velocidade.

Templates de resultado
----------------------
Free preview template
Title: Seu Estilo de Decisão: {BAND_NAME}
Body:
Sinais principais: {TOP1} + {TOP2}. Seu dial de risco está em {TOP3}.

O que isso significa hoje:
- Você tem um jeito padrão de decidir que economiza energia.
- Na situação errada, o mesmo hábito pode gerar erros evitáveis.

Desbloqueie o relatório completo para receber seu Playbook de Decisão: seus melhores ambientes, seus pontos cegos e scripts práticos para resultados mais rápidos e limpos.

Paywall hook paragraph:
Quer o playbook, não só o rótulo? O relatório completo mostra como você decide quando o jogo aperta, onde você pensa demais ou checa de menos, e como ajustar seu risco para ganhar mais vezes.

Estrutura do relatório pago
Report title: Seu Playbook de Decisão
Sections:
1) Seu perfil central (como você pensa, como você se compromete)
2) Velocidade vs precisão: seu ponto ideal por stakes
3) Dial de risco: quando apostar, quando proteger, e como criar guardrails
4) Pontos cegos e armadilhas comuns (e contra-movimentos)
5) Plano de 7 dias (micro-hábitos + scripts reutilizáveis)

Copy do paywall
---------------
CTA: Desbloquear meu Playbook completo de Decisão
Bullets:
- Seu perfil explicado em cenários reais (trabalho, dinheiro, relacionamentos)
- Scripts personalizados para decisões rápidas e de alta qualidade
- Seu dial de risco com guardrails (para ousadia não virar imprudência)
- Um plano de 7 dias para melhorar seus resultados

Checklist de sucesso (LLM)
--------------------------
- test_id, slug, version, category, primary_locale estão presentes.
- Todos os question_id são únicos e estáveis.
- Todos os textos localizados existem para locale: pt-BR.
- O scoring é explícito e determinístico.
- O payload derivado exclui respostas brutas.
- Existe preview e copy paga.
- Sem alegações de diagnóstico e sem coleta de PII.
