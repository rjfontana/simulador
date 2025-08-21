// === Declaração de variáveis globais ===
let base, eixo, tubo;
let rotX = 0, rotY = 0;
let lastMouseX, lastMouseY;
let dragging = false;
let zoom = 0.045;
let inconsolata;
let data = {};
let date, hour, ah, dec;
let ahSlider, decSlider;
let useSlider = false;
let verificarBtn;
let acertou = false;

// Quiz
let quizIndex = 0;
let quizLiberado = Array(13).fill(false);
quizLiberado[0] = true; // libera a primeira questão
let quizDiv, quizFeedbackDiv;

// Coordenadas de Sirius (época J2000)
// RA: 06h 45m 08.9s | DEC: -16° 42′ 58″
const siriusRA = [6, 45, 8.9];
const siriusDEC = [-16, 42, 58];

// Etapa do experimento
let etapa = 0; // 0: só quiz, 1: telescópio escuro, 2: AH, 3: DEC, 4: telescópio colorido, 5: parâmetros, 6: sirius

// Função para calcular AH (ângulo horário) a partir de RA, data e hora local
function calcAH(ra, dateObj) {
  const longitude = -45.45;
  const J2000 = Date.UTC(2000, 0, 1, 12, 0, 0);
  const now = dateObj.getTime();
  const days = (now - J2000) / (1000 * 60 * 60 * 24);

  // GMST em horas
  let GMST = 18.697374558 + 24.06570982441908 * days;
  GMST = (GMST % 24 + 24) % 24;

  // LST em horas
  let LST = GMST + longitude / 15.0;
  LST = (LST % 24 + 24) % 24;

  // RA em horas decimais
  let raDec = ra[0] + ra[1] / 60 + ra[2] / 3600;

  // AH em horas
  let AH = LST - raDec;
  if (AH < -12) AH += 24;
  if (AH > 12) AH -= 24;
  return AH;
}

// === Função para atualização periódica do arquivo JSON ===
async function getJSONData() {
  data = await loadJSON('assets/config.json');
}

// === Pré-carregamento dos modelos 3D, fonte e JSON ===
function preload() {
  base = loadModel('assets/base.obj', false);
  eixo = loadModel('assets/eixo.obj', false);
  tubo = loadModel('assets/tubo.obj', false);
  inconsolata = loadFont('assets/inconsolata.otf');
  data = loadJSON('assets/config.json');
  setInterval(getJSONData, 1000);
}

// === Configuração da tela e da fonte ===
function setup() {
  createCanvas(windowWidth, windowHeight, WEBGL);
  textFont(inconsolata);
  textSize(14);
  textAlign(CENTER, TOP);

  // Sliders para ajuste sutil dos eixos (acima do telescópio)
  // AH agora de -12h a +12h
  ahSlider = createSlider(-12, 12, 0, 0.01).style('width', '180px');
  decSlider = createSlider(-90, 90, 0, 0.1).style('width', '180px');
  ahSlider.input(() => { useSlider = true; acertou = false; });
  decSlider.input(() => { useSlider = true; acertou = false; });

  // Botão para verificar se está ajustado para Sirius
  verificarBtn = createButton('Verificar posição Sirius');
  verificarBtn.style('font-size', '14px');
  verificarBtn.style('background', '#222');
  verificarBtn.style('color', '#eee');
  verificarBtn.style('border', '1px solid #444');
  verificarBtn.mousePressed(() => {
    verificarSirius();
    mostrarExplicacaoSirius();
  });

  // Botão para ativar/desativar rotação pelo mouse
  window.moveBtn = createButton('Desativar rotação pelo mouse')
    .style('font-size', '14px')
    .style('background', '#222')
    .style('color', '#eee')
    .style('border', '1px solid #444')
    .style('margin-top', '12px')
    .position(30, windowHeight / 2 - 330);

  window.moveEnabled = true;
  window.moveBtn.mousePressed(() => {
    window.moveEnabled = !window.moveEnabled;
    window.moveBtn.html(window.moveEnabled ? 'Desativar rotação pelo mouse' : 'Ativar rotação pelo mouse');
  });

  positionControls();
  setupQuiz();
  windowResized();
}

// UX: posiciona sliders acima do telescópio, botão e info abaixo
function positionControls() {
  let x = 30;
  let yBase = windowHeight / 2 - 260;
  const sliderSpacing = 70;
  const labelOffset = 32;

  // AH
  if (!window.ahLabel) {
    window.ahLabel = createDiv('Ajuste AH (h)')
      .style('color', '#ccc')
      .style('font-size', '15px')
      .style('background', 'transparent');
  }
  window.ahLabel.position(x, yBase - labelOffset);
  if (ahSlider) ahSlider.position(x, yBase);
  ahSlider.elt.disabled = false; // Sempre habilitado

  // DEC
  if (!window.decLabel) {
    window.decLabel = createDiv('Ajuste DEC (°)')
      .style('color', '#ccc')
      .style('font-size', '15px')
      .style('background', 'transparent');
  }
  window.decLabel.position(x, yBase + sliderSpacing - labelOffset);
  if (decSlider) decSlider.position(x, yBase + sliderSpacing);
  decSlider.elt.disabled = false; // Sempre habilitado

  // Botão Sirius só aparece na etapa 6
  if (etapa === 6) {
    verificarBtn.show();
    verificarBtn.position(x, windowHeight / 2 + 60);
  } else {
    verificarBtn.hide();
  }

  // Bloco de informações
  if (window.infoDiv) {
    let infoY = windowHeight / 2 + 120;
    window.infoDiv.position(x, infoY);
  }
}

// Redimensionamento responsivo
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  positionControls();
  if (quizDiv) {
    quizDiv.style('top', '40px').style('right', '40px');
  }
}

// === Função principal de desenho ===
function draw() {
  background(0);

  // Só mostra quiz se etapa < 1
  if (etapa < 1) {
    if (quizDiv) quizDiv.show();
    // Oculta tudo do telescópio
    ahSlider.hide();
    decSlider.hide();
    window.ahLabel.hide();
    window.decLabel.hide();
    if (window.infoDiv) window.infoDiv.hide();
    verificarBtn.hide();
    return;
  }

  // Telescópio aparece escurecido até etapa 4
  push();
  translate(0, 0, 0);
  scale(zoom);
  rotateX(rotX);
  rotateY(rotY);

  if (etapa < 4) {
    ambientMaterial(40); // escurecido
    stroke(60);
  } else {
    ambientMaterial(200); // colorido
    stroke(180);
  }
  rotateY(-150 * PI / 180);
  rotateX(-HALF_PI); // HALF_PI é igual a PI/2, gira 90° para cima
  model(base);

  // === EIXO ===
  ambientMaterial(220);
  stroke(180);
  rotateZ(-ahSlider.value() * 15 * PI / 180);
  translate(0, 0, 2397);
  model(eixo);

  // === TUBO ===
  ambientMaterial(255);
  stroke(200);
  translate(-508, 0, 0);
  rotateX(-decSlider.value() * PI / 180);
  model(tubo);
  pop();

  // Sliders só aparecem nas etapas certas
  if (etapa >= 2) {
    ahSlider.show();
    window.ahLabel.show();
    ahSlider.elt.disabled = false;
  } else {
    ahSlider.hide();
    window.ahLabel.hide();
  }
  if (etapa >= 3) {
    decSlider.show();
    window.decLabel.show();
    decSlider.elt.disabled = false;
  } else {
    decSlider.hide();
    window.decLabel.hide();
  }

  // Parâmetros só aparecem a partir da etapa 5
  if (etapa >= 5) {
    if (!window.infoDiv) {
      window.infoDiv = createDiv('').style('position', 'absolute');
    }
    let info = `
      <div style="color:${acertou ? '#00ff64' : '#e0e0e0'};font-family:monospace;font-size:16px;background:transparent;">
        <b>PE160</b><br>
        AH: ${ahSlider.value().toFixed(2)}<br>
        DEC: ${decSlider.value().toFixed(2)}<br>
        ${acertou ? '<span style="color:#00ff64;font-weight:bold;">Ajuste correto! Sirius está no campo!</span>' : ''}
      </div>
    `;
    window.infoDiv.html(info);
    window.infoDiv.show();
  } else if (window.infoDiv) {
    window.infoDiv.hide();
  }

  // Botão Sirius só aparece na etapa 6
  if (etapa === 6) {
    verificarBtn.show();
    // Mostra dados de Sirius na tela
    // Exemplo:
    fill(255);
    textAlign(LEFT, TOP);
    text("Ajuste para Sirius: AH ≈ 6,75h | DEC ≈ -16,72°", 40, windowHeight - 80);
  } else {
    verificarBtn.hide();
  }
}

// === Botão: Verificar se está ajustado para Sirius ===
function verificarSirius() {
  // Valores fixos para Sirius (aproximados)
  const ahSirius = 6.75; // 6h 45m
  const decSirius = -16.72; // -16° 43'

  let ahAtual = ahSlider.value();
  let decAtual = decSlider.value();

  // Tolerância mais flexível: 0.25h para AH (~15min) e 0.5° para DEC
  if (abs(ahAtual - ahSirius) < 0.25 && abs(decAtual - decSirius) < 0.5) {
    acertou = true;
  } else {
    acertou = false;
  }
}

// Explicação sutil ao clicar no botão Sirius
function mostrarExplicacaoSirius() {
  // Cria ou atualiza uma div de explicação próxima ao botão
  if (!window.siriusHintDiv) {
    window.siriusHintDiv = createDiv('').style('position', 'absolute')
      .style('left', (verificarBtn.position().x + 0) + 'px')
      .style('top', (verificarBtn.position().y + 38) + 'px')
      .style('background', 'rgba(30,30,40,0.97)')
      .style('color', '#b0e0ff')
      .style('padding', '10px 16px')
      .style('border-radius', '8px')
      .style('font-size', '15px')
      .style('font-family', 'monospace')
      .style('z-index', '2000')
      .style('box-shadow', '0 2px 12px #0008');
  }
  window.siriusHintDiv.html(
    (etapa === 6 && acertou)
      ? '✅ Parabéns! Os controles estão ajustados para Sirius.<br><b style="color:#ffe066;">Senha 1: sol</b>'
      : 'Ajuste os controles de AH (aprox. 6,75h) e DEC (aprox. -16,72°) para apontar o telescópio para Sirius.<br>Depois, clique novamente para verificar.'
  );
  window.siriusHintDiv.show();
  clearTimeout(window.siriusHintTimeout);
  window.siriusHintTimeout = setTimeout(() => {
    window.siriusHintDiv.hide();
  }, 6000);
}

// === Quiz interativo no canto direito ===
const quizData = [
  // 1
  {
    pergunta: `<b>Introdução à óptica geométrica</b><br>
    Chamamos de fontes de luz os corpos capazes de emitir ou refletir a luz. Corpos que emitem luz própria, como o Sol, são chamados de fontes de luz primárias. Já os corpos que não produzem luz própria, isto é, apenas refletem a luz de outras fontes, são chamados de fontes de luz secundárias.<br><br>
    <b>Questão 1:</b> O Sol é um exemplo de:<br>`,
    opcoes: [
      "A) Fonte de luz secundária",
      "B) Fonte de luz primária",
      "C) Fonte de luz translúcida",
      "D) Fonte de luz opaca"
    ],
    correta: 1,
    justificativa: "O Sol emite luz própria, sendo uma fonte de luz primária."
  },
  // 2
  {
    pergunta: `As fontes de luz também são classificadas de acordo com suas dimensões. Elas são chamadas pontuais ou puntiformes quando a fonte tem tamanho desprezível em relação ao ambiente de propagação. Nas fontes pontuais, os raios têm uma única origem.<br><br>
    <b>Questão 2:</b> Uma estrela distante é considerada uma fonte de luz:<br>`,
    opcoes: [
      "A) Extensa",
      "B) Translúcida",
      "C) Pontual",
      "D) Opaca"
    ],
    correta: 2,
    justificativa: "Estrelas distantes são fontes de luz pontuais."
  },
  // 3
  {
    pergunta: `Selecione a alternativa que apresenta corretamente uma fonte de luz primária:<br>`,
    opcoes: [
      "A) O reflexo de uma pessoa em um espelho.",
      "B) A chama de um fogão.",
      "C) A Lua cheia.",
      "D) Uma parede branca iluminada."
    ],
    correta: 1,
    justificativa: "A chama do fogão emite luz própria, sendo fonte primária."
  },
  // 4
  {
    pergunta: `A representação retilínea da luz é denominada raio de luz. O conjunto de raios de luz é chamado feixe de luz e pode ser caracterizado em paralelo, divergente e convergente.<br>
    <img src="assets/feixes_luz.png" width="320" alt="Tipos de feixe de luz"><br>
    <b>Questão 4:</b> O feixe de luz que representa os raios se afastando de um ponto é chamado de:<br>`,
    opcoes: [
      "A) Feixe paralelo",
      "B) Feixe divergente",
      "C) Feixe convergente",
      "D) Feixe opaca"
    ],
    correta: 1,
    justificativa: "No feixe divergente, os raios se afastam de um ponto."
  },
  // 5
  {
    pergunta: `Chamamos de meios ópticos os meios materiais em que pode haver a propagação da luz.<br>
    <img src="assets/meios_opticos.png" width="320" alt="Meios ópticos"><br>
    <b>Questão 5:</b> O ar atmosférico é um exemplo de meio:<br>`,
    opcoes: [
      "A) Translúcido",
      "B) Opaco",
      "C) Transparente",
      "D) Refletor"
    ],
    correta: 2,
    justificativa: "O ar atmosférico é um meio transparente para a luz visível."
  },
  // 6
  {
    pergunta: `Analise as afirmações abaixo e escolha a alternativa que apresenta apenas fontes luminosas primárias:<br>
    A) lanterna acesa, espelho plano, vela apagada.<br>
    B) lâmpada acesa, fio aquecido ao rubro, vaga-lume aceso.<br>
    C) olho-de-gato, Lua, palito de fósforo aceso.<br>
    D) planeta Marte, fio aquecido ao rubro, parede de cor clara.<br>
    E) vídeo de uma TV em funcionamento, Sol, lâmpada apagada.<br>`,
    opcoes: [
      "A",
      "B",
      "C",
      "D",
      "E"
    ],
    correta: 1,
    justificativa: "Lâmpada acesa, fio aquecido ao rubro e vaga-lume aceso são fontes primárias."
  },
  // 7
  {
    pergunta: `Considere as características de fontes de luz pontuais e extensas.<br>
    Qual das alternativas abaixo descreve corretamente um exemplo de fonte de luz extensa?<br>
    A) Uma vela acesa observada à grande distância.<br>
    B) Um farol de carro ligado, visto de longe, à noite.<br>
    C) A tela acesa de uma televisão vista do sofá.<br>
    D) Uma estrela distante visível no céu noturno.<br>`,
    opcoes: [
      "A",
      "B",
      "C",
      "D"
    ],
    correta: 2,
    justificativa: "A tela da TV é uma fonte extensa, pois tem tamanho apreciável em relação ao ambiente."
  },
  // 8
  {
    pergunta: `A respeito dos meios de propagação da luz, analise as seguintes afirmativas:<br>
    I. A água pura é um meio transparente.<br>
    II. O papel vegetal é um meio translúcido.<br>
    III. O ferro polido é um meio opaco.<br>
    Assinale a alternativa correta:<br>`,
    opcoes: [
      "A) Apenas a afirmativa I é verdadeira.",
      "B) Nenhuma das afirmativas é verdadeira.",
      "C) Todas as afirmativas são verdadeiras.",
      "D) Apenas as afirmativas I e II são verdadeiras.",
      "E) Apenas as afirmativas II e III são verdadeiras."
    ],
    correta: 2,
    justificativa: "Todas as afirmativas estão corretas."
  },
  // 9
  {
    pergunta: `Analise as afirmações a seguir e selecione a opção correta:<br/>
    1. O eclipse solar ocorre quando a Lua bloqueia a luz do Sol, projetando uma sombra na superfície da Terra.<br/>
    2. O eclipse lunar acontece quando a Terra bloqueia a luz do Sol que deveria iluminar a Lua, formando uma região de sombra.<br/>
    3. A formação das sombras durante os eclipses depende do fato de que a luz se propaga em linha reta.<br/>`,
    opcoes: [
      "A) Apenas a afirmativa 2 está correta.",
      "B) Apenas as afirmativas 2 e 3 estão corretas.",
      "C) Apenas as afirmativas 1 e 3 estão corretas.",
      "D) Todas as afirmativas estão corretas."
    ],
    correta: 3,
    justificativa: "Todas as afirmativas estão corretas."
  },
  // 10
  {
    pergunta: `O fenômeno da reflexão da luz consiste na mudança da direção da luz ao incidir em uma superfície refletora, retornando ao meio de origem. A característica fundamental da reflexão da luz é tornar iluminado qualquer corpo. Essa reflexão pode ocorrer de uma série de maneiras distintas, dependendo do material onde a luz incide. Essas reflexões distintas são chamadas de fenômenos ópticos.<br><br>
    <b>Questão 10:</b> O espelho do telescópio Perkin-Elmer é um exemplo de reflexão:<br>`,
    opcoes: [
      "A) Difusa",
      "B) Regular",
      "C) Opaca",
      "D) Translúcida"
    ],
    correta: 1,
    justificativa: "O espelho do telescópio realiza reflexão regular, pois é polido e liso."
  },
  // 11 (ajustada)
  {
    pergunta: `
      Quando a superfície refletora é lisa ou polida, ocorre a reflexão regular da luz. Observe, na representação gráfica, que os raios incidentes e os raios refletidos permanecem paralelos.<br>
      Quando a superfície refletora é rugosa ou irregular, ocorre a reflexão difusa da luz. Observe, na representação gráfica, que os raios incidem paralelamente e são refletidos de forma irregular.<br>
      <img src="assets/reflexao_regular_difusa.png" width="320" alt="Reflexão regular e difusa"><br>
      <b>Questão 11:</b> O que ocorre com a luz ao incidir em uma superfície rugosa?<br>
    `,
    opcoes: [
      "A) É refletida de forma regular.",
      "B) É absorvida totalmente.",
      "C) É refletida de forma difusa.",
      "D) É transmitida sem alteração."
    ],
    correta: 2,
    justificativa: "Superfícies rugosas promovem reflexão difusa."
  },
  // 12
  {
    pergunta: `Um estudante está analisando diferentes sistemas ópticos e suas aplicações. Ele observa as seguintes situações:<br>
    1. Um telescópio que utiliza uma lente objetiva para formar uma imagem real e uma lente ocular para ampliá-la.<br>
    2. Um espelho parabólico usado em um telescópio para captar luz de objetos distantes.<br>
    3. Uma lupa utilizada para observar detalhes de pequenos objetos.<br>
    4. Um espelho plano posicionado para redirecionar a luz em um experimento.<br>
    5. Um microscópio composto que utiliza lentes para ampliar imagens.<br><br>
    Com base nas características desses sistemas ópticos, qual das alternativas classifica corretamente cada sistema quanto ao seu tipo principal de operação?<br>`,
    opcoes: [
      "A) Refratores: 1, 3, 5; Refletores: 2, 4",
      "B) Refratores: 1, 3, 5; Refletores: 2; Nenhum: 4",
      "C) Refratores: 1, 3, 4; Refletores: 2, 5",
      "D) Refratores: 1, 5; Refletores: 2, 3, 4",
      "E) Refratores: 1, 3; Refletores: 2, 4, 5"
    ],
    correta: 0,
    justificativa: "1, 3, 5 são refratores (lentes); 2, 4 são refletores (espelhos)."
  }
];

function setupQuiz() {
  // Cria o quiz no canto direito
  if (!quizDiv) {
    quizDiv = createDiv('').style('position', 'absolute')
      .style('top', '40px')
      .style('right', '40px')
      .style('width', '400px')
      .style('background', 'rgba(20,20,20,0.98)')
      .style('border-radius', '12px')
      .style('padding', '22px 18px 18px 18px')
      .style('color', '#eee')
      .style('font-family', 'monospace')
      .style('font-size', '15px')
      .style('box-shadow', '0 2px 16px #0008')
      .style('z-index', '1000');
  }
  if (!quizFeedbackDiv) {
    quizFeedbackDiv = createDiv('').parent(quizDiv)
      .style('margin-top', '12px')
      .style('font-size', '14px');
  }
  renderQuiz();
}

// Interatividade mais agradável para o quiz
function renderQuiz() {
  let q = quizData[quizIndex];
  let html = `
    <b>Quiz de Óptica (${quizIndex + 1}/${quizData.length})</b><br><br>
    <div style="margin-bottom:12px;">${q.pergunta}</div>
    <div id="quiz-options"></div>
    <div id="quiz-progress" style="margin-top:18px;font-size:13px;color:#aaa;">
      ${quizIndex + 1} de ${quizData.length} questões
    </div>
  `;
  quizDiv.html(html);
  quizFeedbackDiv.html('');

  // Renderiza opções com animação
  let optionsDiv = select('#quiz-options', quizDiv);
  q.opcoes.forEach((op, i) => {
    let btn = createButton(op)
      .parent(optionsDiv)
      .style('width', '100%')
      .style('margin', '6px 0')
      .style('background', '#222')
      .style('color', '#eee')
      .style('border', '1px solid #444')
      .style('padding', '8px 0')
      .style('border-radius', '6px')
      .style('font-size', '15px')
      .style('transition', 'background 0.2s, color 0.2s')
      .mouseOver(function() { this.style('background', '#333'); })
      .mouseOut(function() { this.style('background', '#222'); })
      .mousePressed(() => responderQuizAnimado(i, btn));
  });
}

// Nova função para feedback animado e bloqueio de múltiplos cliques
function responderQuizAnimado(resposta, btn) {
  let q = quizData[quizIndex];
  // Desabilita todos os botões
  selectAll('button', quizDiv).forEach(b => b.attribute('disabled', true));
  if (resposta === q.correta) {
    btn.style('background', '#00ff64').style('color', '#111');
    quizFeedbackDiv.html(`<span style="color:#00ff64;font-weight:bold;">Correto!</span><br><span style="color:#aaa;">${q.justificativa}</span>`);
    quizLiberado[quizIndex + 1] = true;

    // Atualiza etapa conforme questão respondida
    if (quizIndex === 0) etapa = 1;
    if (quizIndex === 1) etapa = 2;
    if (quizIndex === 2) etapa = 3;
    if (quizIndex === 3) etapa = 4;
    if (quizIndex === 4) etapa = 5;
    if (quizIndex === 11) etapa = 6;

    setTimeout(() => {
      if (quizIndex < quizData.length - 1) {
        quizIndex++;
        renderQuiz();
      } else {
        quizDiv.html('<b>Quiz finalizado! Todas as interações liberadas.</b>');
        quizFeedbackDiv.html('');
        quizLiberado = quizLiberado.map(() => true);
        positionControls();
      }
      positionControls();
    }, 1800);
  } else {
    btn.style('background', '#ff5050').style('color', '#fff');
    quizFeedbackDiv.html(`<span style="color:#ff5050;font-weight:bold;">Incorreto!</span>`);
    setTimeout(() => {
      btn.style('background', '#222').style('color', '#eee');
      selectAll('button', quizDiv).forEach(b => b.attribute('disabled', false));
      quizFeedbackDiv.html('');
    }, 1200);
  }
}

// Substitua window.responderQuiz por uma função vazia para evitar conflito
window.responderQuiz = function() {};

// Libera interações do telescópio conforme progresso no quiz
function interacaoLiberada() {
  // Só controla o botão Sirius
  return {
    sliders: true, // sempre habilitado
    botao: quizLiberado[quizLiberado.length - 1]
  };
}

// Mouse drag para girar
function mousePressed() {
  if (mouseButton === LEFT) {
    dragging = true;
    lastMouseX = mouseX;
    lastMouseY = mouseY;
  }
}

function mouseReleased() {
  dragging = false;
}

function mouseDragged() {
  if (dragging && window.moveEnabled) {
    rotY += (mouseX - lastMouseX) * 0.01;
    rotX += (mouseY - lastMouseY) * 0.01;
    lastMouseX = mouseX;
    lastMouseY = mouseY;
  }
}

// Zoom com scroll
function mouseWheel(event) {
  zoom -= event.delta * 0.0005;
  zoom = constrain(zoom, 0.01, 0.2);
}
