/* Pure pricing math. Shared by the app and the Node tests.
   v3: blank prices are "not yet priced" (never $0), NCF is excluded from commission,
   commission is held when a price includes taxes of unknown amount. */
(function (root) {
  function num(v) { var n = parseFloat(v); return isFinite(n) ? n : 0; }
  function blank(v) { return v === '' || v == null || !isFinite(parseFloat(v)); }
  function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }
  var TAXED = { Cruise: 1, Hotel: 1, Resort: 1 };            // categories that normally carry separate taxes/fees
  function travelerCount(trip) {
    var n = num(trip.adults) + num(trip.children);
    return n > 0 ? n : 1;
  }
  function itemRate(item, settings) {
    if (item.nonCommissionable) return 0;
    if (item.rateOverride !== '' && item.rateOverride != null && isFinite(parseFloat(item.rateOverride))) return num(item.rateOverride);
    var s = (settings.suppliers || []).find(function (x) { return x.id === item.supplierId; });
    return s ? num(s.commission) : 0;
  }
  function calcItem(item, settings) {
    var cost = num(item.cost), taxes = num(item.taxes);
    var included = item.includeInTotal !== false;
    var clinic = item.category === 'Clinic appointment';
    var priced = !blank(item.cost);
    var taxesMissing = !clinic && included && priced && !!TAXED[item.category] && blank(item.taxes) && !item.noTaxes;
    var rate = itemRate(item, settings);
    var ncf = Math.min(cost, Math.max(0, num(item.ncf)));
    var base = Math.max(0, cost - ncf);                       // commissionable base: excludes NCF; taxes/port fees are separate
    var hold = !!item.commissionHold && rate > 0;             // price includes taxes we can't split out yet
    var gross = (included || item.commissionWhenExcluded) && !hold ? base * rate / 100 : 0;
    return { cost: cost, taxes: taxes, ncf: ncf, base: base, rate: rate, included: included, priced: priced || clinic,
      taxesMissing: taxesMissing, hold: hold,
      clientPrice: included ? cost + taxes : 0, gross: round2(gross) };
  }
  function calcTrip(trip, settings) {
    var items = trip.items || [];
    var lines = items.map(function (it) { return calcItem(it, settings); });
    var sub = 0, taxes = 0, commissionable = 0, gross = 0, outside = 0, ncf = 0, unpriced = [], holds = [], cats = [];
    lines.forEach(function (l, i) {
      var it = items[i];
      if (l.included) {
        sub += l.cost; taxes += l.taxes; if (l.rate > 0 && !l.hold) commissionable += l.base; ncf += l.ncf;
        if (it.category !== 'Clinic appointment') {
          if (!l.priced) unpriced.push({ index: i, category: it.category, description: it.description || '', what: 'price' });
          else { if (cats.indexOf(it.category) < 0) cats.push(it.category); if (l.taxesMissing) unpriced.push({ index: i, category: it.category, description: it.description || '', what: 'taxes' }); }
        }
        if (l.hold) holds.push({ index: i, category: it.category, description: it.description || '' });
      } else outside += l.cost + l.taxes;
      gross += l.gross;
    });
    var fee = num(trip.planningFee);
    var split = num(settings.foraSplit);
    var feeKeep = settings.feeKeep === '' || settings.feeKeep == null ? 100 : num(settings.feeKeep);
    var commissionTakeHome = gross * split / 100;
    var feeTakeHome = fee * feeKeep / 100;
    var clientTotal = sub + taxes + fee;
    var pax = travelerCount(trip);
    return {
      lines: lines,
      subtotal: round2(sub), taxes: round2(taxes), planningFee: round2(fee), ncf: round2(ncf),
      clientTotal: round2(clientTotal), perPerson: round2(clientTotal / pax), travelers: pax,
      commissionable: round2(commissionable), gross: round2(gross),
      foraShare: round2(gross - commissionTakeHome),
      commissionTakeHome: round2(commissionTakeHome), feeTakeHome: round2(feeTakeHome),
      takeHome: round2(commissionTakeHome + feeTakeHome),
      /* effective rate = gross commission ÷ bookings base (taxes, port fees and planning fee excluded) */
      effectiveRate: sub > 0 ? round2(gross / sub * 100) : 0,
      paidOutside: round2(outside),
      unpriced: unpriced, unpricedCount: unpriced.length, complete: unpriced.length === 0,
      holds: holds, components: cats
    };
  }
  /* "From $X + 2 items not yet priced" / "$X" */
  function totalLabel(r, money) {
    if (r.complete) return money(r.clientTotal);
    return 'From ' + money(r.clientTotal) + ' + ' + r.unpricedCount + ' item' + (r.unpricedCount === 1 ? '' : 's') + ' not yet priced';
  }
  /* "cruise + flights + hotel" from the categories that actually have prices */
  function componentsLabel(list) {
    var m = { Cruise: 'cruise', Flights: 'flights', Hotel: 'hotel', Resort: 'resort', Transfers: 'transfers', Excursion: 'excursions', Tour: 'tours', Insurance: 'insurance', Dining: 'dining', Other: 'other' };
    return (list || []).map(function (c) { return m[c] || String(c).toLowerCase(); }).join(' + ');
  }
  var api = { num: num, blank: blank, round2: round2, travelerCount: travelerCount, itemRate: itemRate, calcItem: calcItem, calcTrip: calcTrip, totalLabel: totalLabel, componentsLabel: componentsLabel };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.ForaCalc = api;
})(this);
