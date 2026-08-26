/* In-page assertions for contrastive-matrix, run by
   framework/tools/check_component.py at the component's last step.

   Under test/browser/ rather than beside the jsdom suites because `npm test`
   runs test/*.js under node, where there is no document to talk to.

   These live here rather than in the jsdom suite because they are about the
   pixels: the slide's whole claim is that a second view of an image really is
   nearest its own source under this stand-in encoder. jsdom stubs the canvas,
   so there it would only ever be checking synthetic data.

   Returns [{label, ok, detail}] — the tool prints and counts them.            */
(() => {
  const out = [];
  const add = (label, ok, detail = '') => out.push({ label, ok, detail: String(detail) });
  const N = 4;

  const cells = () => [...document.querySelectorAll('#cmStage .cm-cell')];
  const read = () => {
    const M = Array.from({ length: N }, () => Array(N).fill(NaN));
    cells().forEach(e => { M[+e.dataset.r][+e.dataset.c] = parseFloat(e.textContent); });
    return M;
  };
  const at = k => { STEPS.set(k); };            // the sandbox's host shim

  // ---- step 2: the encoder's twelve numbers --------------------------------
  at(2);
  const vecs = [...document.querySelectorAll('#cmStage .cm-vec')];
  add('eight strips — one per view', vecs.length === 8, vecs.length);
  add('twelve squares in each', vecs.every(v => v.children.length === 12),
      [...new Set(vecs.map(v => v.children.length))].join(','));
  const sq = [...document.querySelectorAll('#cmStage .cm-vec i')]
               .map(e => e.getBoundingClientRect());
  add('the cells are square, not bars',
      sq.every(r => Math.abs(r.width - r.height) < 0.5),
      [...new Set(sq.map(r => r.width.toFixed(1) + '×' + r.height.toFixed(1)))].join(' '));
  add('each vector is boxed, so the twelve read as one thing',
      vecs.every(v => parseFloat(getComputedStyle(v).borderTopWidth) >= 1));
  add('and the box takes its tile\'s colour, so the axes stay apart',
      new Set(vecs.map(v => getComputedStyle(v).borderTopColor)).size === 2,
      [...new Set(vecs.map(v => getComputedStyle(v).borderTopColor))].join(' / '));
  add('a strip runs along its own row or column, and clears its neighbours',
      vecs.every(v => { const r = v.getBoundingClientRect();
        return Math.max(r.width, r.height) < 81; }),
      'pitch is 81px');
  add('the strips carry signal, not one flat colour',
      new Set([...document.querySelectorAll('#cmStage .cm-vec i')]
                .map(i => i.style.background)).size > 20,
      new Set([...document.querySelectorAll('#cmStage .cm-vec i')]
                .map(i => i.style.background)).size + ' distinct fills over 96 squares');
  add('and nothing downstream has appeared yet',
      [...document.querySelectorAll('#cmStage .cm-cell')].every(e => !e.classList.contains('on')));

  // ---- step 3: raw cosine similarities -------------------------------------
  at(3);
  const S = read();
  add('the matrix is 4 × 4', cells().length === 16, cells().length);
  add('before the softmax the cells are cosines, in [-1, 1]',
      S.flat().every(v => Number.isFinite(v) && v >= -1.0001 && v <= 1.0001),
      'range ' + Math.min(...S.flat()).toFixed(2) + ' … ' + Math.max(...S.flat()).toFixed(2));

  // the claim the slide makes, checked both ways round
  const rowsOK = S.map((row, i) => row.every((v, j) => j === i || row[i] > v));
  add('the second view is nearest its own source — in every row',
      rowsOK.every(Boolean), rowsOK.map((b, i) => (b ? '' : 'row ' + i)).join(' ') || 'all 4');
  const colsOK = S.map((_, j) => S.every((row, i) => i === j || S[j][j] > row[j]));
  add('and in every column too',
      colsOK.every(Boolean), colsOK.map((b, j) => (b ? '' : 'col ' + j)).join(' ') || 'all 4');

  const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
  const diag = M => M.map((row, i) => row[i]);
  const offd = M => M.flatMap((row, i) => row.filter((_, j) => i !== j));
  add('positives beat negatives by a clear margin, not a hair',
      mean(diag(S)) - mean(offd(S)) > 0.5,
      'mean ' + mean(diag(S)).toFixed(2) + ' vs ' + mean(offd(S)).toFixed(2));

  // ---- step 5: the same numbers, softmaxed along each row -------------------
  at(5);
  const P = read();
  add('after the softmax step every cell is a percentage',
      cells().every(e => /^\d+%$/.test(e.textContent.trim())),
      cells()[0].textContent);
  const sums = P.map(row => row.reduce((a, b) => a + b, 0));
  add('and every row is a distribution — it sums to 100',
      sums.every(v => Math.abs(v - 100) <= 2), sums.join(' | '));
  add('the Σ column says so on the slide',
      [...document.querySelectorAll('#cmStage .cm-sum')].every(e => /Σ\s*100%/.test(e.textContent)),
      document.querySelector('#cmStage .cm-sum').textContent.trim());
  add('the softmax preserves the ordering — the diagonal still wins every row',
      P.every((row, i) => row.every((v, j) => j === i || row[i] > v)));

  // ---- step 6: τ, and whether it actually does anything --------------------
  at(6);
  const tau = document.querySelector('#cmTauR');
  const setTau = v => { tau.value = String(v); tau.dispatchEvent(new Event('input')); };
  const snapshot = () => cells().map(e => e.textContent).join(',');

  setTau(20); const at20 = read(), text20 = snapshot();
  setTau(5);  const low  = read(), textLow = snapshot();
  setTau(300);const high = read(), textHigh = snapshot();

  add('moving τ changes the matrix itself, not just a readout',
      textLow !== text20 && textHigh !== text20,
      'three distinct matrices');
  add('low τ concentrates each row on its match',
      mean(diag(low)) > 97, mean(diag(low)).toFixed(0) + '% on the diagonal at τ = 0.05');
  add('and starves the negatives',
      mean(offd(low)) < 2, mean(offd(low)).toFixed(1) + '% mean off-diagonal');
  add('high τ flattens every cell toward 1/N = 25%',
      Math.max(...high.flat()) - Math.min(...high.flat()) < 35,
      'spread ' + (Math.max(...high.flat()) - Math.min(...high.flat())).toFixed(0) +
      ' points at τ = 3.00');
  add('τ is monotone on the matched pair',
      mean(diag(low)) > mean(diag(at20)) && mean(diag(at20)) > mean(diag(high)),
      [low, at20, high].map(M => mean(diag(M)).toFixed(0) + '%').join(' > '));
  add('the rows stay distributions at every τ',
      [low, at20, high].every(M => M.every(row =>
        Math.abs(row.reduce((a, b) => a + b, 0) - 100) <= 2)));

  setTau(20);
  add('the readout agrees with the matrix it sits beside',
      Math.abs(parseFloat(document.querySelector('#cmOut b').textContent) -
               mean(diag(at20))) <= 1,
      document.querySelector('#cmOut b').textContent + ' vs ' + mean(diag(at20)).toFixed(0) + '%');
  add('chance for 4 columns is named as 25%',
      document.querySelector('#cmOut').textContent.includes('25%'));

  // The commentary sits in a fixed-height box, so an overlong line laps the note
  // underneath instead of making the column taller — nothing else would catch it
  const box = document.querySelector('#cmPoints');
  const spill = [];
  for(let k = 0; k <= STEPS.max; k++){
    at(k);
    const line = document.querySelector('#cmPoints .cm-point.on');
    if(line && line.scrollHeight > box.clientHeight)
      spill.push('step ' + k + ' +' + (line.scrollHeight - box.clientHeight) + 'px');
  }
  add('every step\'s commentary fits its box', spill.length === 0,
      spill.join(', ') || 'box ' + box.clientHeight + 'px');
  at(STEPS.max);

  return out;
})()
