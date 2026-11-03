const $ = id => document.getElementById(id);

let questions = [];
let answers = Array(32).fill('');
let student = {};
let idx = 0;
let endAt = 0;
let timer = null;
let submitting = false;

const letters = ['A', 'B', 'C', 'D', 'E'];
const TOTAL_TIME = 9000; // 2h30 em segundos

// Carrega as questões do arquivo JSON
fetch('questoes.json')
  .then(response => {
    if (!response.ok) throw new Error('Não foi possível carregar as questões.');
    return response.json();
  })
  .then(data => {
    if (!Array.isArray(data) || data.length !== 32) {
      throw new Error('O arquivo precisa conter exatamente 32 questões.');
    }

    questions = data;
  })
  .catch(error => {
    $('start').innerHTML = `
      <h2>Erro ao carregar o simulado</h2>
      <p>${error.message}</p>
      <p>Confira se o arquivo questoes.json está publicado no GitHub.</p>
    `;
  });

// Inicia o simulado
$('form').addEventListener('submit', event => {
  event.preventDefault();

  if (questions.length !== 32) {
    alert('Aguarde o carregamento das questões e tente novamente.');
    return;
  }

  const nome = $('nome').value.trim();
  const turma = $('turma').value.trim();

  if (!nome || !turma) {
    alert('Preencha seu nome e sua turma.');
    return;
  }

  student = {
    nome,
    numero: $('numero').value.trim(),
    turma
  };

  answers = Array(32).fill('');
  idx = 0;
  endAt = Date.now() + TOTAL_TIME * 1000;

  $('start').classList.add('hidden');
  $('exam').classList.remove('hidden');

  $('who').textContent = nome + ' · ' + turma;

  render();
  tick();
  timer = setInterval(tick, 1000);
});

// Exibe a questão atual
function render() {
  const q = questions[idx];
  const count = answers.filter(Boolean).length;

  $('qn').textContent = 'Questão ' + q.n;
  $('tipo').textContent = q.tipo || '';
  $('qtext').textContent = q.enunciado;
  $('progress').textContent = count + ' de 32 respondidas';
  $('bar').style.width = (count / 32 * 100) + '%';

  // Tabela, quando existir na questão
  $('qtable').replaceChildren();

  if (q.tabela) {
    const table = document.createElement('table');
    table.className = 'qt';

    q.tabela.forEach(row => {
      const tr = table.insertRow();

      row.forEach(value => {
        const cell = tr.insertCell();
        cell.textContent = value;
      });
    });

    $('qtable').append(table);
  }

  // Dica da questão
  $('hintbox').textContent =
    window.DICAS?.[idx] ||
    'Releia o enunciado e identifique o conteúdo matemático envolvido.';

  $('hintbox').classList.add('hidden');
  $('hintbtn').textContent = '💡 Ver dica';
  $('hintbtn').setAttribute('aria-expanded', 'false');

  // Alternativas
  $('choices').replaceChildren();

  q.alternativas.forEach((alternative, i) => {
    const label = document.createElement('label');
    label.className = 'choice';

    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'answer';
    radio.value = letters[i];
    radio.checked = answers[idx] === letters[i];

    radio.addEventListener('change', () => {
      answers[idx] = letters[i];
      render();
    });

    label.append(
      radio,
      document.createTextNode(letters[i] + ') ' + alternative)
    );

    $('choices').append(label);
  });

  // Navegação pelas questões
  $('numbers').replaceChildren();

  questions.forEach((question, i) => {
    const button = document.createElement('button');

    button.type = 'button';
    button.textContent = i + 1;

    button.className =
      (answers[i] ? 'answered ' : '') +
      (idx === i ? 'active' : '');

    button.addEventListener('click', () => {
      idx = i;
      render();
    });

    $('numbers').append(button);
  });

  $('prev').disabled = idx === 0;
  $('next').disabled = idx === 31;
}

// Mostrar ou esconder dica
$('hintbtn').addEventListener('click', () => {
  const show = $('hintbox').classList.contains('hidden');

  $('hintbox').classList.toggle('hidden', !show);
  $('hintbtn').textContent = show
    ? '💡 Ocultar dica'
    : '💡 Ver dica';

  $('hintbtn').setAttribute('aria-expanded', String(show));
});

// Navegação
$('prev').addEventListener('click', () => {
  if (idx > 0) {
    idx--;
    render();
  }
});

$('next').addEventListener('click', () => {
  if (idx < 31) {
    idx++;
    render();
  }
});

$('finish').addEventListener('click', () => submit(false));

// Cronômetro
function tick() {
  const left = Math.max(
    0,
    Math.ceil((endAt - Date.now()) / 1000)
  );

  const hours = Math.floor(left / 3600);
  const minutes = Math.floor((left % 3600) / 60);
  const seconds = left % 60;

  $('clock').textContent = [hours, minutes, seconds]
    .map(value => String(value).padStart(2, '0'))
    .join(':');

  if (left === 0) {
    clearInterval(timer);
    submit(true);
  }
}

// Finalização e envio
async function submit(expired) {
  if (submitting) return;

  const missing = answers.filter(answer => !answer).length;

  if (!expired) {
    const message = missing
      ? 'Existem ' + missing +
        ' questões sem resposta. Deseja finalizar mesmo assim?'
      : 'Deseja finalizar e enviar o simulado?';

    if (!confirm(message)) return;
  }

  submitting = true;

  $('finish').disabled = true;
  $('prev').disabled = true;
  $('next').disabled = true;
  $('numbers').style.pointerEvents = 'none';
  $('choices').style.pointerEvents = 'none';

  $('status').textContent = 'Enviando suas respostas...';

  const tempoSegundos = Math.min(
    TOTAL_TIME,
    Math.max(0, TOTAL_TIME - Math.ceil((endAt - Date.now()) / 1000))
  );

  const payload = {
    ...student,
    respostas: answers,
    tempoSegundos,
    finalizadoPorTempo: expired,
    simulado: 'Matemática 3º Ano EM - 32 questões'
  };

  try {
    const response = await fetch(window.SIMULADO_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify(payload),
      redirect: 'follow'
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.error || 'O servidor não confirmou o envio.');
    }

    clearInterval(timer);

    showResults(data.protocolo || 'Registrado', data);

  } catch (error) {
    submitting = false;

    $('status').textContent =
      'Não foi possível confirmar o envio. ' +
      'Suas respostas continuam nesta página. ' +
      'Tente novamente. Detalhes: ' + error.message;

    $('finish').disabled = false;
    $('prev').disabled = idx === 0;
    $('next').disabled = idx === 31;
    $('numbers').style.pointerEvents = '';
    $('choices').style.pointerEvents = '';
  }
}

// Resultado e correção
function showResults(protocol, serverData) {
  $('exam').classList.add('hidden');
  $('done').classList.remove('hidden');

  const hits = questions.reduce((total, q, i) => {
    return total + (answers[i] === q.gabarito ? 1 : 0);
  }, 0);

  const grade = hits / 32 * 10;

  $('result').textContent =
    'Você acertou ' + hits + ' de 32 questões. Sua nota: ' +
    grade.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }) + ' / 10,00.';

  $('receipt').textContent =
    'Aluno: ' + student.nome +
    ' · Turma: ' + student.turma +
    ' · Protocolo: ' + protocol;

  const details = $('details');
  details.replaceChildren();

  questions.forEach((q, i) => {
    const correct = q.gabarito;
    const marked = answers[i];
    const isCorrect = marked === correct;

    const box = document.createElement('div');
    box.className = 'review ' + (isCorrect ? 'good' : 'bad');

    const title = document.createElement('strong');
    title.textContent =
      'Questão ' + q.n + ' — ' +
      (isCorrect ? 'Correta' : 'Incorreta');

    const answer = document.createElement('p');
    answer.textContent =
      'Sua resposta: ' + (marked || 'Não respondida') +
      ' · Gabarito: ' + correct;

    const skill = document.createElement('small');
    skill.textContent = q.tipo || '';

    const resolution = document.createElement('p');
    resolution.textContent = q.resolucao || '';

    box.append(title, answer, skill, resolution);
    details.append(box);
  });

  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
}
