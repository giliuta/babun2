/* Minimal DC runtime — renders the Babun «Финансы» .dc.html design
   (x-dc template + {{bindings}} + sc-for/sc-if/onClick) without the
   proprietary platform support.js. Custom-written for this mockup. */
(function () {
  class DCLogic {
    setState(patch) {
      const p = typeof patch === 'function' ? patch(this.state) : patch;
      this.state = Object.assign({}, this.state, p);
      if (window.__dcRender) window.__dcRender();
    }
  }
  window.DCLogic = DCLogic;

  const bindInner = (s) => { const m = /\{\{([\s\S]+?)\}\}/.exec(s || ''); return m ? m[1].trim() : null; };

  function evalExpr(expr, B, scope) {
    expr = expr.trim();
    const dot = expr.indexOf('.');
    if (dot > 0) {
      const head = expr.slice(0, dot);
      if (scope && head in scope) {
        let v = scope[head];
        for (const part of expr.slice(dot + 1).split('.')) v = v == null ? undefined : v[part];
        return v;
      }
    }
    if (scope && expr in scope) return scope[expr];
    return B ? B[expr] : undefined;
  }

  const subst = (str, B, scope) =>
    str.replace(/\{\{([\s\S]+?)\}\}/g, (_, e) => { const v = evalExpr(e, B, scope); return v == null ? '' : String(v); });

  function processChildren(parent, B, scope) {
    const kids = Array.prototype.slice.call(parent.childNodes);
    for (const node of kids) processNode(node, B, scope);
  }

  function processNode(node, B, scope) {
    if (node.nodeType === 3) { // text
      if (node.nodeValue && node.nodeValue.indexOf('{{') >= 0) node.nodeValue = subst(node.nodeValue, B, scope);
      return;
    }
    if (node.nodeType !== 1) return;
    const tag = node.tagName.toUpperCase();

    if (tag === 'SC-FOR') {
      const list = evalExpr(bindInner(node.getAttribute('list')), B, scope) || [];
      const alias = node.getAttribute('as') || 'item';
      const tplHTML = node.innerHTML;
      const frag = document.createDocumentFragment();
      list.forEach((item) => {
        const holder = document.createElement('div');
        holder.innerHTML = tplHTML;
        const childScope = Object.assign({}, scope); childScope[alias] = item;
        processChildren(holder, B, childScope);
        while (holder.firstChild) frag.appendChild(holder.firstChild);
      });
      node.replaceWith(frag);
      return;
    }

    if (tag === 'SC-IF') {
      const cond = evalExpr(bindInner(node.getAttribute('value')), B, scope);
      if (cond) {
        const holder = document.createElement('div');
        holder.innerHTML = node.innerHTML;
        processChildren(holder, B, scope);
        const frag = document.createDocumentFragment();
        while (holder.firstChild) frag.appendChild(holder.firstChild);
        node.replaceWith(frag);
      } else {
        node.remove();
      }
      return;
    }

    // regular element — attributes then children
    Array.prototype.slice.call(node.attributes).forEach((attr) => {
      const name = attr.name, val = attr.value;
      if (name.lastIndexOf('hint-placeholder', 0) === 0) { node.removeAttribute(name); return; }
      if (/^on/i.test(name) && /^\s*\{\{[\s\S]+\}\}\s*$/.test(val)) {
        const fn = evalExpr(bindInner(val), B, scope);
        node.removeAttribute(name);
        if (typeof fn === 'function') node.addEventListener(name.slice(2).toLowerCase(), fn);
        return;
      }
      if (val.indexOf('{{') >= 0) {
        const nv = subst(val, B, scope);
        node.setAttribute(name, nv);
        if (name === 'value') node.value = nv;
      }
    });
    processChildren(node, B, scope);
  }

  function mount() {
    const xdc = document.querySelector('x-dc');
    const dataScript = document.querySelector('script[type="text/x-dc"][data-dc-script]');
    if (!xdc || !dataScript) return;
    const helmet = xdc.querySelector('helmet');
    if (helmet) { document.head.insertAdjacentHTML('beforeend', helmet.innerHTML); helmet.remove(); }
    const templateHTML = xdc.innerHTML;
    let Component;
    try {
      Component = (new Function('DCLogic', dataScript.textContent + '\n;return Component;'))(DCLogic);
    } catch (e) { console.error('DC component eval failed:', e); return; }
    const comp = window.__dcComp = new Component();
    if (!comp.state) comp.state = {};
    const root = document.createElement('div');
    xdc.replaceWith(root);
    window.__dcRender = function () {
      let B;
      try { B = comp.renderVals(); } catch (e) { console.error('renderVals failed:', e); return; }
      root.innerHTML = templateHTML;
      processChildren(root, B, {});
    };
    window.__dcRender();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
