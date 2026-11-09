/* Pure pricing math. Shared by the app and the Node test. */
(function (root) {
  function num(v) { var n = parseFloat(v); return isFinite(n) ? n : 0; }
  function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }
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
    var rate = itemRate(item, settings);
    var gross = included || item.commissionWhenExcluded ? cost * rate / 100 : 0;
    return { cost: cost, taxes: taxes, rate: rate, included: included,
      clientPrice: included ? cost + taxes : 0, gross: round2(gross) };
  }
  function calcTrip(trip, settings) {
    var items = trip.items || [];
    var lines = items.map(function (it) { return calcItem(it, settings); });
    var sub = 0, taxes = 0, commissionable = 0, gross = 0, outside = 0;
    lines.forEach(function (l, i) {
      if (l.included) { sub += l.cost; taxes += l.taxes; if (l.rate > 0) commissionable += l.cost; }
      else outside += l.cost + l.taxes;
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
      subtotal: round2(sub), taxes: round2(taxes), planningFee: round2(fee),
      clientTotal: round2(clientTotal), perPerson: round2(clientTotal / pax), travelers: pax,
      commissionable: round2(commissionable), gross: round2(gross),
      foraShare: round2(gross - commissionTakeHome),
      commissionTakeHome: round2(commissionTakeHome), feeTakeHome: round2(feeTakeHome),
      takeHome: round2(commissionTakeHome + feeTakeHome),
      effectiveRate: sub > 0 ? round2(gross / sub * 100) : 0,
      paidOutside: round2(outside)
    };
  }
  var api = { num: num, round2: round2, travelerCount: travelerCount, itemRate: itemRate, calcItem: calcItem, calcTrip: calcTrip };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.ForaCalc = api;
})(this);
