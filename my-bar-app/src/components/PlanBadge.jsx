import { useSubscription } from '../contexts/SubscriptionContext';
import { TIER_INFO } from '../utils/subscriptionUtils';
import './PlanBadge.css';

export default function PlanBadge() {
  const { subscription, loading } = useSubscription();

  if (loading) {
    return <span className="plan-badge plan-loading">Loading...</span>;
  }

  if (!subscription?.subscription_tier) {
    return <span className="plan-badge plan-trial">🎯 Free Trial</span>;
  }

  const tierInfo = TIER_INFO[subscription.subscription_tier];
  
  if (!tierInfo) {
    return null;
  }

  const tierClass = `plan-${subscription.subscription_tier}`;

  return (
    <span className={`plan-badge ${tierClass}`} title={tierInfo.price}>
      {tierInfo.name}
    </span>
  );
}
