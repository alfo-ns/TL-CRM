const Api = (() => {
  async function req(method, url, body) {
    const opts = { method, headers: {} };
    if (body !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    const res = await fetch(url, opts);
    if (!res.ok) {
      let msg = res.statusText;
      try { const j = await res.json(); if (j && j.error) msg = j.error; } catch (e) {}
      throw new Error(msg || ('HTTP ' + res.status));
    }
    return res.json();
  }

  return {
    bootstrap: () => req('GET', '/api/bootstrap'),

    createCompany: (payload) => req('POST', '/api/companies', payload),
    updateCompany: (id, payload) => req('PUT', '/api/companies/' + id, payload),
    moveCompanyStage: (id, stage) => req('POST', '/api/companies/' + id + '/stage', { stage }),
    setCompanyNext: (id, payload) => req('POST', '/api/companies/' + id + '/next', payload),
    completeCompanyAction: (id) => req('POST', '/api/companies/' + id + '/complete-action'),
    addActivity: (id, testo) => req('POST', '/api/companies/' + id + '/activities', { testo }),
    deleteCompany: (id) => req('DELETE', '/api/companies/' + id),

    createContact: (payload) => req('POST', '/api/contacts', payload),
    updateContact: (id, payload) => req('PUT', '/api/contacts/' + id, payload),
    completeContactAction: (id) => req('POST', '/api/contacts/' + id + '/complete-action'),
    deleteContact: (id) => req('DELETE', '/api/contacts/' + id),

    createBridge: (payload) => req('POST', '/api/bridges', payload),
    updateBridge: (id, payload) => req('PUT', '/api/bridges/' + id, payload),
    deleteBridge: (id) => req('DELETE', '/api/bridges/' + id),
    linkBridge: (id, companyId) => req('POST', '/api/bridges/' + id + '/link', { companyId }),
    unlinkBridge: (id, companyId) => req('POST', '/api/bridges/' + id + '/unlink', { companyId }),

    createOperator: (nome) => req('POST', '/api/operators', { nome }),
    renameOperator: (id, nome) => req('PUT', '/api/operators/' + id, { nome }),
    deleteOperator: (id) => req('DELETE', '/api/operators/' + id),
  };
})();
