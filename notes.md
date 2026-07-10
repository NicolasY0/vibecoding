循环
    let i = lo;
    for (let j = lo; j < hi; j++) {
      animQueue.push({ type: 'state', index: j, state: 'compare' });
      comparisons++;
      updateStats('比较中...');

      if (a[j] < pivotVal) {
        if (i !== j) {
          animQueue.push({ type: 'slide-swap', i, j, vi: a[i], vj: a[j] });
        }
        [a[i], a[j]] = [a[j], a[i]];
        swaps++;
        if (i !== j) {
          animQueue.push({ type: 'clear', index: i });
          animQueue.push({ type: 'clear', index: j });
        }
        i++;
      }
      animQueue.push({ type: 'clear', index: j });
    }

