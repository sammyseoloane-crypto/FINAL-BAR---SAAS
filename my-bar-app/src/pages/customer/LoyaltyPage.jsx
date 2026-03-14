import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import DashboardLayout from '../../components/DashboardLayout';
import '../owner/Pages.css';
import './LoyaltyPage.css';

export default function LoyaltyPage() {
  const { user, userProfile } = useAuth();
  const [loyaltyData, setLoyaltyData] = useState(null);
  const [rewards, setRewards] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState(null);

  useEffect(() => {
    if (user && userProfile?.tenant_id) {
      loadLoyaltyData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, userProfile]);

  async function loadLoyaltyData() {
    try {
      // Get customer loyalty account
      const { data: loyalty, error: loyaltyError } = await supabase
        .from('customer_loyalty')
        .select(`
          *,
          loyalty_programs(*),
          loyalty_tiers(*)
        `)
        .eq('user_id', user.id)
        .eq('tenant_id', userProfile.tenant_id)
        .single();

      if (loyaltyError) {
        // Auto-enroll if no account exists
        if (loyaltyError.code === 'PGRST116') {
          await enrollCustomer();
          return;
        }
        throw loyaltyError;
      }

      setLoyaltyData(loyalty);

      // Load available rewards
      const { data: rewardsData, error: rewardsError } = await supabase
        .from('rewards_catalog')
        .select('*')
        .eq('tenant_id', userProfile.tenant_id)
        .eq('is_active', true)
        .lte('valid_from', new Date().toISOString())
        .or(`valid_until.is.null,valid_until.gte.${new Date().toISOString()}`)
        .order('points_cost');

      if (rewardsError) {
        throw rewardsError;
      }

      setRewards(rewardsData || []);

      // Load recent loyalty transactions
      const { data: txData, error: txError } = await supabase
        .from('loyalty_transactions')
        .select('*')
        .eq('customer_loyalty_id', loyalty.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (txError) {
        throw txError;
      }

      setTransactions(txData || []);
    } catch (error) {
      console.error('Error loading loyalty data:', error);
      alert(`Failed to load loyalty data: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function enrollCustomer() {
    try {
      // Get default loyalty program
      const { data: program } = await supabase
        .from('loyalty_programs')
        .select('id')
        .eq('tenant_id', userProfile.tenant_id)
        .eq('is_active', true)
        .single();

      if (!program) {
        setLoading(false);
        return;
      }

      // Enroll customer
      const { error } = await supabase.from('customer_loyalty').insert({
        user_id: user.id,
        tenant_id: userProfile.tenant_id,
        program_id: program.id,
        current_points: 0,
        lifetime_points: 0,
      });

      if (error) {
        throw error;
      }

      await loadLoyaltyData();
    } catch (error) {
      console.error('Error enrolling customer:', error);
      setLoading(false);
    }
  }

  async function redeemReward(reward) {
    if (!loyaltyData || loyaltyData.current_points < reward.points_cost) {
      alert('Insufficient points');
      return;
    }

    if (redeeming) {
      return;
    }

    if (!window.confirm(`Redeem ${reward.name} for ${reward.points_cost} points?`)) {
      return;
    }

    setRedeeming(reward.id);

    try {
      // Create redemption
      const { error: redemptionError } = await supabase.from('reward_redemptions').insert({
        customer_loyalty_id: loyaltyData.id,
        reward_id: reward.id,
        points_spent: reward.points_cost,
        status: 'pending',
        expires_at: reward.valid_until,
      });

      if (redemptionError) {
        throw redemptionError;
      }

      // Deduct points
      const newPoints = loyaltyData.current_points - reward.points_cost;
      const { error: updateError } = await supabase
        .from('customer_loyalty')
        .update({ current_points: newPoints })
        .eq('id', loyaltyData.id);

      if (updateError) {
        throw updateError;
      }

      // Log transaction
      await supabase.from('loyalty_transactions').insert({
        customer_loyalty_id: loyaltyData.id,
        points_redeemed: reward.points_cost,
        balance_after: newPoints,
        description: `Redeemed: ${reward.name}`,
      });

      alert('✅ Reward redeemed successfully! Show this to staff.');
      await loadLoyaltyData();
    } catch (error) {
      console.error('Error redeeming reward:', error);
      alert(`Failed to redeem reward: ${error.message}`);
    } finally {
      setRedeeming(null);
    }
  }

  function getTierBadge() {
    if (!loyaltyData?.loyalty_tiers) {
      return { name: 'Bronze', color: '#cd7f32', icon: '🥉' };
    }

    const tier = loyaltyData.loyalty_tiers;
    return {
      name: tier.name,
      color: tier.color || '#cd7f32',
      icon: tier.icon || '🏆',
    };
  }

  function getNextTierInfo() {
    if (!loyaltyData?.loyalty_programs?.tier_system_enabled) {
      return null;
    }

    const currentPoints = loyaltyData.lifetime_points;
    // This is simplified - in reality you'd query the next tier
    const tiers = [
      { name: 'Bronze', points: 0, icon: '🥉' },
      { name: 'Silver', points: 500, icon: '🥈' },
      { name: 'Gold', points: 1500, icon: '🥇' },
      { name: 'VIP', points: 5000, icon: '👑' },
    ];

    const nextTier = tiers.find((t) => t.points > currentPoints);
    if (!nextTier) {
      return null;
    }

    const pointsNeeded = nextTier.points - currentPoints;
    const progress = (currentPoints / nextTier.points) * 100;

    return { ...nextTier, pointsNeeded, progress };
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div style={{ padding: '40px', textAlign: 'center' }}>
          <p>Loading loyalty program...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!loyaltyData) {
    return (
      <DashboardLayout>
        <div className="loyalty-empty">
          <h2>🎁 Loyalty Program Not Available</h2>
          <p>This venue does not have a loyalty program yet.</p>
        </div>
      </DashboardLayout>
    );
  }

  const tierBadge = getTierBadge();
  const nextTier = getNextTierInfo();

  return (
    <DashboardLayout>
      <div className="loyalty-page">
        <div className="page-header">
          <h2>🎁 Loyalty Rewards</h2>
          <p>Earn points and unlock exclusive rewards</p>
        </div>

        {/* Points Card */}
        <div className="loyalty-points-card">
          <div className="loyalty-points-header">
            <div className="loyalty-tier-badge" style={{ background: tierBadge.color }}>
              <span className="loyalty-tier-icon">{tierBadge.icon}</span>
              <span className="loyalty-tier-name">{tierBadge.name}</span>
            </div>
            <div className="loyalty-points-display">
              <div className="loyalty-points-number">{loyaltyData.current_points}</div>
              <div className="loyalty-points-label">Available Points</div>
            </div>
          </div>

          <div className="loyalty-stats">
            <div className="loyalty-stat">
              <div className="loyalty-stat-value">{loyaltyData.lifetime_points}</div>
              <div className="loyalty-stat-label">Lifetime Points</div>
            </div>
            <div className="loyalty-stat">
              <div className="loyalty-stat-value">
                R{(loyaltyData.current_points * (loyaltyData.loyalty_programs?.points_per_currency || 1)).toFixed(0)}
              </div>
              <div className="loyalty-stat-label">Points Value</div>
            </div>
          </div>

          {/* Progress to Next Tier */}
          {nextTier && (
            <div className="loyalty-progress-section">
              <div className="loyalty-progress-header">
                <span>Progress to {nextTier.name} {nextTier.icon}</span>
                <span>{nextTier.pointsNeeded} points needed</span>
              </div>
              <div className="loyalty-progress-bar">
                <div className="loyalty-progress-fill" style={{ width: `${Math.min(nextTier.progress, 100)}%` }} />
              </div>
            </div>
          )}
        </div>

        {/* How It Works */}
        <div className="card">
          <div className="card-header">
            <h3>📖 How It Works</h3>
          </div>
          <div className="card-body">
            <div className="loyalty-info-grid">
              <div className="loyalty-info-item">
                <div className="loyalty-info-icon">💰</div>
                <div className="loyalty-info-content">
                  <h4>Earn Points</h4>
                  <p>
                    Get {loyaltyData.loyalty_programs?.points_per_currency || 1} point for every R1 spent
                  </p>
                </div>
              </div>
              <div className="loyalty-info-item">
                <div className="loyalty-info-icon">🎁</div>
                <div className="loyalty-info-content">
                  <h4>Redeem Rewards</h4>
                  <p>Exchange points for exclusive rewards and discounts</p>
                </div>
              </div>
              <div className="loyalty-info-item">
                <div className="loyalty-info-icon">⬆️</div>
                <div className="loyalty-info-content">
                  <h4>Level Up</h4>
                  <p>Reach higher tiers for better perks and bonuses</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Available Rewards */}
        <div className="card">
          <div className="card-header">
            <h3>🎁 Available Rewards ({rewards.length})</h3>
          </div>
          <div className="card-body">
            {rewards.length === 0 ? (
              <div className="loyalty-empty-rewards">
                <p>No rewards available at the moment. Check back soon!</p>
              </div>
            ) : (
              <div className="loyalty-rewards-grid">
                {rewards.map((reward) => {
                  const canAfford = loyaltyData.current_points >= reward.points_cost;
                  return (
                    <div key={reward.id} className={`loyalty-reward-card ${canAfford ? 'affordable' : 'locked'}`}>
                      {reward.image_url && <img src={reward.image_url} alt={reward.name} className="loyalty-reward-image" />}
                      <div className="loyalty-reward-content">
                        <h4 className="loyalty-reward-name">{reward.name}</h4>
                        <p className="loyalty-reward-description">{reward.description}</p>
                        <div className="loyalty-reward-cost">
                          <span className="loyalty-reward-points">{reward.points_cost}</span> points
                        </div>
                        {reward.reward_type === 'discount' && (
                          <div className="loyalty-reward-value">{reward.discount_percentage}% OFF</div>
                        )}
                        <button
                          className="loyalty-reward-btn"
                          onClick={() => redeemReward(reward)}
                          disabled={!canAfford || redeeming === reward.id}
                        >
                          {redeeming === reward.id ? '⏳ Redeeming...' : canAfford ? '✅ Redeem' : '🔒 Not Enough Points'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="card">
          <div className="card-header">
            <h3>📝 Recent Activity</h3>
          </div>
          <div className="card-body">
            {transactions.length === 0 ? (
              <div className="loyalty-empty-transactions">
                <p>No activity yet. Start earning points by making purchases!</p>
              </div>
            ) : (
              <div className="loyalty-transactions">
                {transactions.map((tx) => (
                  <div key={tx.id} className="loyalty-transaction-item">
                    <div className="loyalty-transaction-icon">
                      {tx.points_earned > 0 ? '💰' : '🎁'}
                    </div>
                    <div className="loyalty-transaction-content">
                      <div className="loyalty-transaction-description">{tx.description || 'Transaction'}</div>
                      <div className="loyalty-transaction-date">
                        {new Date(tx.created_at).toLocaleDateString('en-ZA', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </div>
                    </div>
                    <div className={`loyalty-transaction-points ${tx.points_earned > 0 ? 'earned' : 'redeemed'}`}>
                      {tx.points_earned > 0 ? '+' : '-'}
                      {tx.points_earned || tx.points_redeemed} pts
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
