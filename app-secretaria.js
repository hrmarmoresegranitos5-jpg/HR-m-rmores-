// ══════════════════════════════════════════════════════════════════════
// SECRETÁRIA — HR Mármores e Granitos
// Painel completo: briefing, agenda, finanças, orçamentos, diagnóstico
// ══════════════════════════════════════════════════════════════════════

// ── Dados de visitas ──────────────────────────────────────────────────
function _getV() {
  if (!DB.v) {
    try { DB.v = JSON.parse(localStorage.getItem('hr_v')||'[]'); } catch(e){ DB.v=[]; }
  }
  return DB.v;
}
function _saveV() {
  try { localStorage.setItem('hr_v', JSON.stringify(_getV())); } catch(e){}
}

// ── Notificações push ─────────────────────────────────────────────────
function secInitNotif() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') Notification.requestPermission();
  setInterval(secNotifCheck, 60000);
  setTimeout(secNotifCheck, 3000);
}

function secNotifCheck() {
  if (Notification.permission !== 'granted') return;
  var hoje = td();
  var agora = new Date();
  var hh = agora.getHours(), mm = agora.getMinutes();
  var agoraMin = hh*60+mm;

  (_getV()).forEach(function(v){
    if(v.status!=='agendada'||v.date!==hoje||!v.hora) return;
    var p=v.hora.split(':'), vm=(+p[0])*60+(+p[1]), diff=vm-agoraMin;
    if(diff>=28&&diff<=32) _sendNotif('📐 Visita em 30 min!', v.cli+' — '+v.hora, 'v30_'+v.id);
    if(diff>=-2&&diff<=2)  _sendNotif('📐 Hora da visita!', v.cli+' — '+(v.end||v.hora), 'vnow_'+v.id);
  });

  if(hh===8&&mm<5){
    var ch='notif_daily_'+hoje;
    if(localStorage.getItem(ch)) return;
    localStorage.setItem(ch,'1');
    var at=(DB.j||[]).filter(function(j){return !j.done&&j.end&&dDiff(j.end)<0;});
    if(at.length) _sendNotif('⚠️ '+at.length+' entrega(s) atrasada(s)', at.map(function(j){return j.cli;}).join(', '), 'at_'+hoje);
    var vh=(_getV()).filter(function(v){return v.status==='agendada'&&v.date===hoje;});
    if(vh.length) _sendNotif('📅 '+vh.length+' visita(s) hoje', vh.map(function(v){return v.hora+' — '+v.cli;}).join(' | '), 'vh_'+hoje);
    var pend=(DB.t||[]).filter(function(t){return t.type==='pend'&&t.date&&t.date<hoje;});
    if(pend.length){
      var tot=pend.reduce(function(s,t){return s+(t.value||0);},0);
      _sendNotif('💰 R$ '+fm(tot)+' a receber em atraso', pend.length+' pagamento(s) vencido(s)', 'pend_'+hoje);
    }
  }
}

var _notifSent={};
function _sendNotif(title,body,key){
  if(_notifSent[key]) return;
  _notifSent[key]=true;
  try{
    var n=new Notification(title,{body:body,icon:'icon-192.png',badge:'icon-192.png',tag:key});
    n.onclick=function(){window.focus();n.close();};
    setTimeout(function(){n.close();},8000);
  }catch(e){}
}

// ─────────────────────────────────────────────────────────────────────
// RENDER PRINCIPAL
// ─────────────────────────────────────────────────────────────────────
function renderSecretaria() {
  var el = document.getElementById('secBody');
  if (!el) return;
  try {
    _renderSecretariaInner(el);
  } catch(err) {
    el.innerHTML = '<div style="padding:30px 18px;color:var(--t3);font-size:.78rem;">⚠️ Erro ao carregar secretária.<br><small>'+escH(String(err))+'</small></div>';
    console.error('renderSecretaria:', err);
  }
}

function _renderSecretariaInner(el) {
  var hoje = td();
  var agora = new Date();
  var horaAtual = agora.getHours();
  var saudacao = horaAtual < 12 ? 'Bom dia' : horaAtual < 18 ? 'Boa tarde' : 'Boa noite';
  var nomeEmp = (CFG&&CFG.emp&&CFG.emp.nome) ? CFG.emp.nome.split(' ')[0] : 'chefe';

  // ── Cálculos de métricas ──────────────────────────────────────────
  var jobs       = DB.j||[];
  var orcamentos = DB.q||[];
  var transacoes = DB.t||[];
  var visitas    = _getV();

  var atrasados    = jobs.filter(function(j){return !j.done&&j.end&&dDiff(j.end)<0;});
  var urgentes     = jobs.filter(function(j){return !j.done&&j.urgente;});
  var emProd       = jobs.filter(function(j){return !j.done;});
  var concluidos   = jobs.filter(function(j){return j.done;});
  var vencendo3d   = jobs.filter(function(j){return !j.done&&j.end&&dDiff(j.end)>=0&&dDiff(j.end)<=3;});

  var visitasHoje   = visitas.filter(function(v){return v.status==='agendada'&&v.date===hoje;});
  var visitasAmanha = visitas.filter(function(v){return v.status==='agendada'&&v.date===addD(hoje,1);});

  var pendentes    = transacoes.filter(function(t){return t.type==='pend';});
  var pendVenc     = pendentes.filter(function(t){return t.date&&t.date<hoje;});
  var totPend      = pendentes.reduce(function(s,t){return s+(t.value||0);},0);
  var totPendVenc  = pendVenc.reduce(function(s,t){return s+(t.value||0);},0);

  var entradas30   = transacoes.filter(function(t){return t.type==='in'&&t.date&&t.date>=addD(hoje,-30);});
  var gastos30     = transacoes.filter(function(t){return t.type==='out'&&t.date&&t.date>=addD(hoje,-30);});
  var totEnt30     = entradas30.reduce(function(s,t){return s+(t.value||0);},0);
  var totGas30     = gastos30.reduce(function(s,t){return s+(t.value||0);},0);
  var saldo30      = totEnt30 - totGas30;

  var followUps    = _secFollowUps(hoje);

  var totalAlertas = atrasados.length + urgentes.filter(function(j){return !atrasados.find(function(a){return a.id===j.id;});}).length + pendVenc.length + followUps.length;
  var totalAtencao = totalAlertas + visitasHoje.length + vencendo3d.length;

  // ── Diagnóstico ───────────────────────────────────────────────────
  var diagProblemas = _secDiagProblemas();

  var h = '';

  // ══════════════════════════════════════════════════════════════════
  // HERO
  // ══════════════════════════════════════════════════════════════════
  h += '<div class="sec-hero">';
  h += '<div class="sec-saud">'+saudacao+'! 👋</div>';
  h += '<div class="sec-nome">'+escH(nomeEmp)+'</div>';

  // Status geral
  if (totalAlertas > 0) {
    h += '<div class="sec-brief-count">';
    h += '<span class="sec-count-num">'+totalAlertas+'</span>';
    h += '<span class="sec-count-lbl">alert'+(totalAlertas>1?'as':'a')+' requer'+(totalAlertas>1?'em':'')+' ação imediata</span>';
    h += '</div>';
  } else if (vencendo3d.length > 0) {
    h += '<div class="sec-ok" style="color:#f0a040;">⏳ '+vencendo3d.length+' entrega'+(vencendo3d.length>1?'s':'')+' vence'+(vencendo3d.length>1?'m':'')+' em até 3 dias</div>';
  } else {
    h += '<div class="sec-ok">✅ Tudo em ordem! Bom trabalho.</div>';
  }
  h += '</div>';

  // ══════════════════════════════════════════════════════════════════
  // CHIPS DE RESUMO EXECUTIVO
  // ══════════════════════════════════════════════════════════════════
  h += '<div class="sec-chips">';
  h += _secChip(emProd.length,       '🔨','em produção',     'var(--gold2)', 'rgba(201,168,76,.12)');
  h += _secChip(visitasHoje.length,  '📐','visita'+(visitasHoje.length!==1?'s':'')+' hoje', '#60c8ff','rgba(96,200,255,.1)');
  h += _secChip(totPend>0?'R$ '+_fmShort(totPend):'—', '💰','a receber','#6abf6a','rgba(100,200,100,.1)');
  h += _secChip(atrasados.length,    '⚠️','atrasado'+(atrasados.length!==1?'s':''), 'var(--red)','rgba(201,68,68,.12)');
  h += '</div>';

  // ══════════════════════════════════════════════════════════════════
  // DIAGNÓSTICO DO SISTEMA
  // ══════════════════════════════════════════════════════════════════
  h += '<div class="sec-section-lbl">🔍 Diagnóstico do Sistema</div>';
  h += '<div class="sec-diag-card">';

  if (diagProblemas.length === 0) {
    h += '<div class="sec-diag-ok">';
    h += '<span style="font-size:1.4rem;">✅</span>';
    h += '<div>';
    h += '<div style="font-weight:700;font-size:.84rem;color:#6abf6a;">Sistema operando normalmente</div>';
    h += '<div style="font-size:.72rem;color:var(--t3);margin-top:2px;">Nenhum problema detectado. Dados íntegros.</div>';
    h += '</div>';
    h += '</div>';
  } else {
    diagProblemas.forEach(function(p) {
      h += '<div class="sec-diag-item" style="border-left-color:'+p.cor+';">';
      h += '<div class="sec-diag-icon">'+p.icon+'</div>';
      h += '<div class="sec-diag-body">';
      h += '<div class="sec-diag-title" style="color:'+p.cor+';">'+p.titulo+'</div>';
      h += '<div class="sec-diag-desc">'+p.desc+'</div>';
      if (p.acao) h += '<div class="sec-diag-acao">'+p.acao+'</div>';
      h += '</div>';
      h += '</div>';
    });
  }

  // Métricas do sistema
  h += '<div class="sec-diag-stats">';
  h += _secDiagStat('📋', orcamentos.length, 'orçamentos');
  h += _secDiagStat('📅', jobs.length, 'serviços');
  h += _secDiagStat('💵', transacoes.length, 'lançamentos');
  h += _secDiagStat('📐', visitas.length, 'visitas');
  h += '</div>';

  h += '</div>'; // sec-diag-card

  // ══════════════════════════════════════════════════════════════════
  // AÇÃO IMEDIATA
  // ══════════════════════════════════════════════════════════════════
  if (atrasados.length||urgentes.length||pendVenc.length||followUps.length) {
    h += '<div class="sec-section-lbl">🔴 Ação Imediata</div>';
    h += '<div class="sec-task-list">';

    atrasados.forEach(function(j) {
      var d=Math.abs(dDiff(j.end));
      h += _secTask('⚠️',
        escH(j.cli)+' — '+escH(j.desc),
        d+(d===1?' dia':' dias')+' em atraso · prazo era '+fd(j.end),
        'red',
        'data-editjob="'+j.id+'"',
        'Abrir Serviço');
    });

    pendVenc.forEach(function(t) {
      var dias=Math.abs(dDiff(t.date));
      h += _secTask('💰',
        'Recebimento vencido: '+escH(t.desc),
        'R$ '+fm(t.value||0)+' · venceu há '+dias+' dia'+(dias===1?'':'s')+' ('+fd(t.date)+')',
        'yel',
        'onclick="go(4);if(typeof finTab===\'function\')setTimeout(function(){finTab(\'areceber\');},100);"',
        'Ver Finanças');
    });

    urgentes.filter(function(j){return !atrasados.find(function(a){return a.id===j.id;});}).forEach(function(j) {
      h += _secTask('🚨',
        'URGENTE: '+escH(j.cli)+' — '+escH(j.desc),
        (j.urgMotivo||'Marcado como urgente')+' · entrega: '+fd(j.end),
        'org',
        'data-editjob="'+j.id+'"',
        'Abrir Serviço');
    });

    followUps.forEach(function(q) {
      var dias=Math.abs(dDiff(q.date));
      h += _secTask('📞',
        'Follow-up pendente: '+escH(q.cli),
        'Orçamento de '+fd(q.date)+' ('+dias+' dias) · R$ '+fm(q.vista)+' · sem contrato fechado',
        'blu',
        'onclick="go(7)"',
        'Ver Histórico');
    });

    h += '</div>';
  }

  // ══════════════════════════════════════════════════════════════════
  // VISITAS HOJE
  // ══════════════════════════════════════════════════════════════════
  if (visitasHoje.length) {
    h += '<div class="sec-section-lbl">📐 Visitas de Hoje</div>';
    h += '<div class="sec-task-list">';
    visitasHoje.sort(function(a,b){return (a.hora||'').localeCompare(b.hora||'');}).forEach(function(v){
      h += _secVisitaCard(v,hoje);
    });
    h += '</div>';
  }

  // ══════════════════════════════════════════════════════════════════
  // PAINEL FINANCEIRO
  // ══════════════════════════════════════════════════════════════════
  h += '<div class="sec-section-lbl">💵 Situação Financeira</div>';
  h += '<div class="sec-fin-card">';

  // Linha 1: últimos 30 dias
  h += '<div class="sec-fin-header">Últimos 30 dias</div>';
  h += '<div class="sec-fin-row">';
  h += '<div class="sec-fin-item">';
  h += '<div class="sec-fin-val" style="color:#6abf6a;">R$ '+fm(totEnt30)+'</div>';
  h += '<div class="sec-fin-lbl">Entradas</div>';
  h += '</div>';
  h += '<div class="sec-fin-item">';
  h += '<div class="sec-fin-val" style="color:var(--red);">R$ '+fm(totGas30)+'</div>';
  h += '<div class="sec-fin-lbl">Gastos</div>';
  h += '</div>';
  h += '<div class="sec-fin-item">';
  h += '<div class="sec-fin-val" style="color:'+(saldo30>=0?'#6abf6a':'var(--red)')+';">R$ '+fm(saldo30)+'</div>';
  h += '<div class="sec-fin-lbl">Saldo</div>';
  h += '</div>';
  h += '</div>';

  // Linha 2: a receber
  if (totPend > 0) {
    h += '<div class="sec-fin-div"></div>';
    h += '<div class="sec-fin-row">';
    h += '<div class="sec-fin-item">';
    h += '<div class="sec-fin-val" style="color:#60c8ff;">R$ '+fm(totPend)+'</div>';
    h += '<div class="sec-fin-lbl">Total a receber</div>';
    h += '</div>';
    if (totPendVenc > 0) {
      h += '<div class="sec-fin-item">';
      h += '<div class="sec-fin-val" style="color:var(--red);">R$ '+fm(totPendVenc)+'</div>';
      h += '<div class="sec-fin-lbl">Vencido ('+pendVenc.length+')</div>';
      h += '</div>';
    }
    var pendOk = pendentes.length - pendVenc.length;
    if (pendOk > 0) {
      h += '<div class="sec-fin-item">';
      h += '<div class="sec-fin-val" style="color:#f0a040;">'+pendOk+'</div>';
      h += '<div class="sec-fin-lbl">No prazo</div>';
      h += '</div>';
    }
    h += '</div>';
  }

  // Linha 3: serviços em produção — valor pendente
  var valProdTotal = emProd.reduce(function(s,j){return s+(j.value-(j.pago||0));},0);
  if (valProdTotal > 0) {
    h += '<div class="sec-fin-div"></div>';
    h += '<div class="sec-fin-row">';
    h += '<div class="sec-fin-item">';
    h += '<div class="sec-fin-val" style="color:var(--gold2);">R$ '+fm(valProdTotal)+'</div>';
    h += '<div class="sec-fin-lbl">Previsto ('+emProd.length+' serviços)</div>';
    h += '</div>';
    h += '</div>';
  }

  h += '<button class="sec-fin-btn" onclick="go(4)">Ver Finanças completo →</button>';
  h += '</div>'; // sec-fin-card

  // ══════════════════════════════════════════════════════════════════
  // PRODUÇÃO — RESUMO DA AGENDA
  // ══════════════════════════════════════════════════════════════════
  h += '<div class="sec-section-lbl">🔨 Produção</div>';
  h += '<div class="sec-prod-card">';

  if (vencendo3d.length > 0) {
    h += '<div class="sec-prod-alerta">⏳ '+vencendo3d.length+' entrega'+(vencendo3d.length>1?'s':'')+' nos próximos 3 dias:</div>';
    vencendo3d.sort(function(a,b){return a.end.localeCompare(b.end);}).forEach(function(j){
      var diff=dDiff(j.end);
      var prazoStr = diff===0?'<span style="color:var(--red);font-weight:700;">HOJE</span>':diff===1?'<span style="color:#f0a040;">amanhã</span>':'em '+diff+' dias';
      h += '<div class="sec-prod-item">';
      h += '<div class="sec-prod-info">';
      h += '<div class="sec-prod-cli">'+escH(j.cli)+'</div>';
      h += '<div class="sec-prod-desc">'+escH(j.desc)+'</div>';
      h += '</div>';
      h += '<div class="sec-prod-prazo">'+prazoStr+'</div>';
      h += '</div>';
    });
  }

  h += '<div class="sec-prod-stats">';
  h += '<div class="sec-prod-stat"><span style="color:var(--gold2);font-weight:700;">'+emProd.length+'</span><br>em produção</div>';
  h += '<div class="sec-prod-stat"><span style="color:var(--red);font-weight:700;">'+atrasados.length+'</span><br>atrasados</div>';
  h += '<div class="sec-prod-stat"><span style="color:#6abf6a;font-weight:700;">'+concluidos.length+'</span><br>concluídos</div>';
  h += '<div class="sec-prod-stat"><span style="color:#f0a040;font-weight:700;">'+vencendo3d.length+'</span><br>vence em 3d</div>';
  h += '</div>';

  h += '<button class="sec-fin-btn" onclick="go(3)">Ver Agenda completa →</button>';
  h += '</div>';

  // ══════════════════════════════════════════════════════════════════
  // ORÇAMENTOS RECENTES
  // ══════════════════════════════════════════════════════════════════
  var orcRecentes = orcamentos.slice(0,5);
  if (orcRecentes.length) {
    h += '<div class="sec-section-lbl">💰 Orçamentos Recentes</div>';
    h += '<div class="sec-orc-list">';
    orcRecentes.forEach(function(q) {
      var temContrato = transacoes.some(function(t){
        return t.type==='in'&&t.date>=(q.date||'')&&t.desc&&t.desc.indexOf(q.cli||'')>=0;
      });
      var status = temContrato ? '✅ Fechado' : (q.date&&dDiff(q.date)<-5?'📞 Follow-up':'⏳ Aberto');
      var statusCol = temContrato ? '#6abf6a' : (q.date&&dDiff(q.date)<-5?'#60c8ff':'#f0a040');
      h += '<div class="sec-orc-item">';
      h += '<div class="sec-orc-info">';
      h += '<div class="sec-orc-cli">'+escH(q.cli||'—')+'</div>';
      h += '<div class="sec-orc-meta">'+(q.date?fd(q.date):'—')+' · '+escH(q.tipo||'')+(q.mat?' · '+escH(q.mat):'')+'</div>';
      h += '</div>';
      h += '<div class="sec-orc-right">';
      h += '<div class="sec-orc-val">R$ '+fm(q.vista||0)+'</div>';
      h += '<div class="sec-orc-status" style="color:'+statusCol+';">'+status+'</div>';
      h += '</div>';
      h += '</div>';
    });
    h += '<button class="sec-fin-btn" onclick="go(7)">Ver Histórico completo →</button>';
    h += '</div>';
  }

  // ══════════════════════════════════════════════════════════════════
  // AGENDAR NOVA VISITA
  // ══════════════════════════════════════════════════════════════════
  h += '<button class="sec-nova-visita" onclick="openVisitaMd(null)">📐 Agendar Visita de Medição</button>';

  // ══════════════════════════════════════════════════════════════════
  // VISITAS AMANHÃ
  // ══════════════════════════════════════════════════════════════════
  if (visitasAmanha.length) {
    h += '<div class="sec-section-lbl">📅 Amanhã</div>';
    h += '<div class="sec-task-list">';
    visitasAmanha.forEach(function(v){h+=_secVisitaCard(v,hoje);});
    h += '</div>';
  }

  // ══════════════════════════════════════════════════════════════════
  // PRÓXIMAS VISITAS
  // ══════════════════════════════════════════════════════════════════
  var proxVisitas = visitas
    .filter(function(v){return v.status==='agendada'&&v.date>addD(hoje,1);})
    .sort(function(a,b){return a.date.localeCompare(b.date)||(a.hora||'').localeCompare(b.hora||'');})
    .slice(0,5);
  if (proxVisitas.length) {
    h += '<div class="sec-section-lbl">🗓 Próximas Visitas</div>';
    h += '<div class="sec-task-list">';
    proxVisitas.forEach(function(v){h+=_secVisitaCard(v,hoje);});
    h += '</div>';
  }

  // ══════════════════════════════════════════════════════════════════
  // VISITAS REALIZADAS RECENTES
  // ══════════════════════════════════════════════════════════════════
  var realizadas = visitas
    .filter(function(v){return v.status==='realizada';})
    .sort(function(a,b){return b.date.localeCompare(a.date);})
    .slice(0,3);
  if (realizadas.length) {
    h += '<div class="sec-section-lbl">✅ Realizadas Recentemente</div>';
    h += '<div class="sec-task-list">';
    realizadas.forEach(function(v){h+=_secVisitaCard(v,hoje);});
    h += '</div>';
  }

  // ══════════════════════════════════════════════════════════════════
  // ESTADO VAZIO
  // ══════════════════════════════════════════════════════════════════
  if (!totalAtencao&&!visitasHoje.length&&!proxVisitas.length&&emProd.length===0) {
    h += '<div class="sec-empty"><div style="font-size:2.5rem;margin-bottom:10px;">🤝</div>';
    h += '<div>Nada urgente no momento. Aproveite para fazer novos orçamentos!</div></div>';
  }

  h += '<div style="height:24px;"></div>';
  el.innerHTML = h;
}

// ─────────────────────────────────────────────────────────────────────
// DIAGNÓSTICO INTELIGENTE
// ─────────────────────────────────────────────────────────────────────
function _secDiagProblemas() {
  var problemas = [];
  var hoje = td();
  var jobs = DB.j||[], orcamentos = DB.q||[], transacoes = DB.t||[];

  // 1. Serviços sem data de entrega
  var semData = jobs.filter(function(j){return !j.done&&!j.end;});
  if (semData.length) {
    problemas.push({
      icon:'📋', cor:'#f0a040',
      titulo: semData.length+' serviço'+(semData.length>1?'s':'')+' sem prazo definido',
      desc: semData.map(function(j){return j.cli;}).join(', '),
      acao: 'Recomendado: abra cada serviço na Agenda e defina a data de entrega.'
    });
  }

  // 2. Serviços com valor zerado
  var semValor = jobs.filter(function(j){return !j.done&&!(j.value>0);});
  if (semValor.length) {
    problemas.push({
      icon:'💵', cor:'#f0a040',
      titulo: semValor.length+' serviço'+(semValor.length>1?'s':'')+' sem valor registrado',
      desc: semValor.map(function(j){return j.cli;}).join(', '),
      acao: 'Registre o valor do serviço para que o controle financeiro seja preciso.'
    });
  }

  // 3. Orçamentos muito antigos sem fechamento (>30 dias)
  var orcAntigos = orcamentos.filter(function(q){
    return q.date && dDiff(q.date) < -30;
  });
  if (orcAntigos.length) {
    problemas.push({
      icon:'🗂️', cor:'#888',
      titulo: orcAntigos.length+' orçamento'+(orcAntigos.length>1?'s':'')+' com mais de 30 dias',
      desc: 'Orçamentos antigos podem distorcer relatórios e o histórico.',
      acao: 'Considere arquivar orçamentos que não vão avançar.'
    });
  }

  // 4. Gastos > entradas no mês
  var primMes = hoje.substring(0,7)+'-01';
  var entMes = transacoes.filter(function(t){return t.type==='in'&&(t.date||'')>=primMes;}).reduce(function(s,t){return s+(t.value||0);},0);
  var gasMes = transacoes.filter(function(t){return t.type==='out'&&(t.date||'')>=primMes;}).reduce(function(s,t){return s+(t.value||0);},0);
  if (gasMes > entMes && gasMes > 0) {
    problemas.push({
      icon:'📉', cor:'var(--red)',
      titulo: 'Gastos superam entradas este mês',
      desc: 'Entradas: R$ '+fm(entMes)+' · Gastos: R$ '+fm(gasMes)+' · Déficit: R$ '+fm(gasMes-entMes),
      acao: 'Verifique os lançamentos em Finanças e confirme se todos os recebimentos foram registrados.'
    });
  }

  // 5. CFG não configurada
  if (!CFG||!CFG.emp||!CFG.emp.nome) {
    problemas.push({
      icon:'⚙️', cor:'var(--red)',
      titulo: 'Empresa não configurada',
      desc: 'Nome da empresa ausente nas configurações.',
      acao: 'Acesse Configurações → Empresa e preencha os dados.'
    });
  }

  // 6. Nenhuma pedra cadastrada
  if (!CFG||!CFG.stones||CFG.stones.length===0) {
    problemas.push({
      icon:'🪨', cor:'#f0a040',
      titulo: 'Nenhuma pedra/material cadastrado',
      desc: 'O catálogo de materiais está vazio.',
      acao: 'Acesse Configurações → Pedras para adicionar materiais.'
    });
  }

  // 7. Muitos serviços simultâneos (sobrecarga)
  var hoje_d = new Date();
  var emProdAtivos = jobs.filter(function(j){
    if(j.done||!j.start||!j.end) return false;
    var s=new Date(j.start+'T00:00:00'), e=new Date(j.end+'T00:00:00');
    return s<=hoje_d && e>=hoje_d;
  });
  if (emProdAtivos.length >= 5) {
    problemas.push({
      icon:'⚡', cor:'#f0a040',
      titulo: emProdAtivos.length+' serviços em execução simultânea',
      desc: 'Alta carga de produção. Verifique a capacidade da equipe.',
      acao: 'Revise os prazos na Agenda para evitar atrasos por sobrecarga.'
    });
  }

  return problemas;
}

function _secDiagStat(icon, val, label) {
  return '<div class="sec-ds-item"><span class="sec-ds-icon">'+icon+'</span><span class="sec-ds-val">'+val+'</span><span class="sec-ds-lbl">'+label+'</span></div>';
}

// ─────────────────────────────────────────────────────────────────────
// HELPERS DE RENDER
// ─────────────────────────────────────────────────────────────────────
function _secChip(val, icon, label, color, bg) {
  return '<div class="sec-chip" style="color:'+color+';background:'+bg+';">'
    +'<span class="sec-chip-i">'+icon+'</span>'
    +'<span class="sec-chip-v">'+val+'</span>'
    +'<span class="sec-chip-l">'+label+'</span>'
    +'</div>';
}

function _secTask(icon, title, sub, color, action, btnLbl) {
  var cm={red:'var(--red)',yel:'#d4a017',org:'#ff9060',blu:'#60a0e0',grn:'var(--grn)'};
  var c=cm[color]||'var(--t3)';
  return '<div class="sec-task" style="border-left-color:'+c+';">'
    +'<div class="sec-task-icon" style="color:'+c+';">'+icon+'</div>'
    +'<div class="sec-task-body">'
      +'<div class="sec-task-title">'+title+'</div>'
      +'<div class="sec-task-sub" style="color:'+c+';">'+sub+'</div>'
    +'</div>'
    +'<button class="sec-task-btn" '+action+'>'+btnLbl+'</button>'
    +'</div>';
}

function _secVisitaCard(v, hoje) {
  var statusMap={agendada:'📐',realizada:'✅',cancelada:'❌'};
  var icon=statusMap[v.status]||'📐';
  var isHoje=v.date===hoje;
  var dateLabel=isHoje?'Hoje':(v.date===addD(hoje,1)?'Amanhã':fd(v.date));
  var statusLabel=v.status==='agendada'?(isHoje?'<span style="color:#60c8ff;font-weight:700;">HOJE</span>':dateLabel):v.status.toUpperCase();

  return '<div class="sec-visita" id="sv_'+v.id+'">'
    +'<div class="sec-vis-head">'
      +'<div class="sec-vis-icon">'+icon+'</div>'
      +'<div class="sec-vis-info">'
        +'<div class="sec-vis-cli">'+escH(v.cli)+'</div>'
        +'<div class="sec-vis-meta">'
          +(v.hora?'🕐 '+v.hora+' · ':'')
          +'📅 '+statusLabel
          +(v.end?' · 📍 '+escH(v.end):'')
        +'</div>'
        +(v.obs?'<div class="sec-vis-obs">'+escH(v.obs)+'</div>':'')
      +'</div>'
    +'</div>'
    +(v.status==='agendada'?'<div class="sec-vis-btns">'
        +'<button class="sec-vis-btn grn" onclick="togVisitaStatus('+v.id+',\'realizada\')">✓ Realizada</button>'
        +'<button class="sec-vis-btn org" onclick="openVisitaMd('+v.id+')">✏️</button>'
        +'<button class="sec-vis-btn red" onclick="togVisitaStatus('+v.id+',\'cancelada\')">✕</button>'
        +(v.tel?'<button class="sec-vis-btn blu" onclick="window.open(\'https://wa.me/55\'+\''+v.tel.replace(/\D/g,'')+'\')">📱</button>':'')
      +'</div>':'<div class="sec-vis-btns">'
        +'<button class="sec-vis-btn" onclick="togVisitaStatus('+v.id+',\'agendada\')">↩ Reagendar</button>'
        +'<button class="sec-vis-btn red" onclick="delVisita('+v.id+')">✕</button>'
      +'</div>')
    +'</div>';
}

function _secFollowUps(hoje) {
  var cutoff=addD(hoje,-5), cutoff2=addD(hoje,-30);
  return (DB.q||[]).filter(function(q){
    if(!q.date||q.date>cutoff||q.date<cutoff2) return false;
    var temContrato=(DB.t||[]).some(function(t){
      return t.desc&&t.desc.indexOf(q.cli||'???')>=0&&t.type==='in'&&t.date>=q.date;
    });
    return !temContrato;
  }).slice(0,3);
}

function _fmShort(v){
  if(v>=1000) return (v/1000).toFixed(1).replace('.',',')+' k';
  return fm(v);
}

// ─────────────────────────────────────────────────────────────────────
// VISITAS — CRUD
// ─────────────────────────────────────────────────────────────────────
var _visitaEditId = null;

function openVisitaMd(id) {
  _visitaEditId = id;
  var md = document.getElementById('visitaMd');
  if (!md) return;
  document.getElementById('vMdTitle').textContent = id ? 'Editar Visita' : '📐 Nova Visita de Medição';
  if (id) {
    var v=(_getV()).find(function(x){return x.id===id;});
    if(!v) return;
    document.getElementById('vCli').value  = v.cli  ||'';
    document.getElementById('vTel').value  = v.tel  ||'';
    document.getElementById('vEnd').value  = v.end  ||'';
    document.getElementById('vData').value = v.date ||td();
    document.getElementById('vHora').value = v.hora ||'';
    document.getElementById('vObs').value  = v.obs  ||'';
  } else {
    document.getElementById('vCli').value  = '';
    document.getElementById('vTel').value  = '';
    document.getElementById('vEnd').value  = '';
    document.getElementById('vData').value = td();
    document.getElementById('vHora').value = '';
    document.getElementById('vObs').value  = '';
    if(pendQ&&pendQ.cli){
      document.getElementById('vCli').value=pendQ.cli;
      if(pendQ.tel) document.getElementById('vTel').value=pendQ.tel;
      if(pendQ.end) document.getElementById('vEnd').value=pendQ.end;
    }
  }
  showMd('visitaMd');
}

function saveVisita() {
  var cli  = document.getElementById('vCli').value.trim();
  var tel  = document.getElementById('vTel').value.trim();
  var end  = document.getElementById('vEnd').value.trim();
  var date = document.getElementById('vData').value;
  var hora = document.getElementById('vHora').value;
  var obs  = document.getElementById('vObs').value.trim();
  if(!cli){toast('Informe o nome do cliente');return;}
  if(!date){toast('Informe a data');return;}

  if(_visitaEditId){
    var v=(_getV()).find(function(x){return x.id===_visitaEditId;});
    if(v){v.cli=cli;v.tel=tel;v.end=end;v.date=date;v.hora=hora;v.obs=obs;_saveV();}
  } else {
    _getV();
    _getV().unshift({id:Date.now(),cli:cli,tel:tel,end:end,date:date,hora:hora,obs:obs,status:'agendada'});
    _saveV();
  }
  closeAll();
  renderSecretaria();
  secNotifDotUpdate();
  toast('✓ Visita '+(_visitaEditId?'atualizada':'agendada')+'!');
}

function togVisitaStatus(id, status) {
  var v=(_getV()).find(function(x){return x.id===id;});
  if(!v) return;
  v.status=status;
  _saveV();
  renderSecretaria();
  secNotifDotUpdate();
  var msgs={realizada:'✅ Visita realizada!',cancelada:'Visita cancelada.',agendada:'Visita reagendada!'};
  toast(msgs[status]||'Atualizado!');
}

function delVisita(id) {
  if(!confirm('Remover visita?')) return;
  DB.v=_getV().filter(function(x){return x.id!==id;});
  _saveV();
  renderSecretaria();
  secNotifDotUpdate();
}

// ── Dot de notificação ────────────────────────────────────────────────
function secNotifDotUpdate() {
  var dot=document.getElementById('secDot');
  if(!dot) return;
  var hoje=td();
  var at=(DB.j||[]).filter(function(j){return !j.done&&j.end&&dDiff(j.end)<0;}).length;
  var vh=(_getV()).filter(function(v){return v.status==='agendada'&&v.date===hoje;}).length;
  var pv=(DB.t||[]).filter(function(t){return t.type==='pend'&&t.date&&t.date<hoje;}).length;
  dot.classList.toggle('on',at>0||vh>0||pv>0);
}
