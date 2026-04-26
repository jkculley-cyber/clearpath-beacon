/**
 * Referral alert criteria.
 * A referral is "alert-worthy" when it meets any of these conditions AND is still open:
 *   - urgency = 'Urgent'
 *   - concern_type = 'Crisis'
 *   - harm_to_self = true   (teacher checked the safety box)
 *   - harm_to_others = true (teacher checked the safety box)
 *
 * Used by:
 *   - Referrals page (top "Active Alerts" section)
 *   - AppShell global banner (visible on every page)
 *   - Import preview (highlight alert-worthy items)
 */

export function isReferralAlert(r) {
  if (!r) return false;
  if (r.status && r.status !== 'open' && r.status !== 'in_progress') return false;
  return (
    r.urgency === 'Urgent' ||
    r.concern_type === 'Crisis' ||
    r.harm_to_self === true ||
    r.harm_to_others === true
  );
}

export function getAlertReasons(r) {
  const reasons = [];
  if (r.harm_to_self === true) reasons.push('Possible harm to self');
  if (r.harm_to_others === true) reasons.push('Possible harm to others');
  if (r.concern_type === 'Crisis') reasons.push('Crisis category');
  if (r.urgency === 'Urgent') reasons.push('Urgent priority');
  return reasons;
}

export function getTopAlertReason(r) {
  // Sort priority: harm to self/others > Crisis > Urgent
  if (r.harm_to_self === true) return 'POSSIBLE HARM TO SELF';
  if (r.harm_to_others === true) return 'POSSIBLE HARM TO OTHERS';
  if (r.concern_type === 'Crisis') return 'CRISIS REFERRAL';
  if (r.urgency === 'Urgent') return 'URGENT REFERRAL';
  return null;
}
