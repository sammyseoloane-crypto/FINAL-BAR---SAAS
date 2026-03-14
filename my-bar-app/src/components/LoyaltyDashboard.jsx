/**
 * Loyalty Dashboard Component
 * Displays customer loyalty points, rewards, and redemption options
 */

import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { supabase } from '../supabaseClient';
import './LoyaltyDashboard.css';

function LoyaltyDashboard({ customerId }) {
  const [loyaltyData, setLoyaltyData] = useState(null);
  const [rewards, setRewards] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReward, setSelectedReward] = useState(null);
  const [showRedeemModal, setShowRedeemModal] = useState(false);

  useEffect(() => {
    if (customerId) {
      fetchLoyaltyData();
      fetchRewards();
      fetchTransactions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  const fetchLoyaltyData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('customer_loyalty')
        .select(
          `
          *,
          loyalty_programs (
            name,
            points_per_dollar,
            points_per_visit,
            tier_system
          )
        `,
        )
        .eq('user_id', customerId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      setLoyaltyData(data);
    } catch (error) {
      console.error('Error fetching loyalty data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRewards = async () => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', customerId)
        .single();

      if (!profile) {
        return;
      }

      const { data, error } = await supabase
        .from('rewards_catalog')
        .select('*')
        .eq('tenant_id', profile.tenant_id)
        .eq('active', true)
        .order('points_cost', { ascending: true });

      if (error) {
        throw error;
      }

      setRewards(data || []);
    } catch (error) {
      console.error('Error fetching rewards:', error);
    }
  };

  const fetchTransactions = async () => {
    try {
      const { data, error } = await supabase
        .from('loyalty_transactions')
        .select('*')
        .eq('customer_loyalty_id', loyaltyData?.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        throw error;
      }

      setTransactions(data || []);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    }
  };

  const handleRedeemReward = async (reward) => {
    if (!loyaltyData || loyaltyData.points_balance < reward.points_cost) {
      alert('Insufficient points');
      return;
    }

    try {
      // Call the redeem function
      const { error } = await supabase.rpc('redeem_reward', {
        p_customer_loyalty_id: loyaltyData.id,
        p_reward_id: reward.id,
        p_points_cost: reward.points_cost,
        p_description: `Redeemed: ${reward.name}`,
      });

      if (error) {
        throw error;
      }

      alert(`Successfully redeemed ${reward.name}!`);
      setShowRedeemModal(false);
      setSelectedReward(null);

      // Refresh data
      fetchLoyaltyData();
      fetchTransactions();
    } catch (error) {
      console.error('Error redeeming reward:', error);
      alert('Failed to redeem reward. Please try again.');
    }
  };

  const getTierBadge = (tier) => {
    const badges = {
      bronze: '🥉',
      silver: '🥈',
      gold: '🥇',
      platinum: '💎',
      vip: '👑',
    };
    return badges[tier?.toLowerCase()] || '⭐';
  };

  const getTierColor = (tier) => {
    const colors = {
      bronze: '#cd7f32',
      silver: '#c0c0c0',
      gold: '#ffd700',
      platinum: '#e5e4e2',
      vip: '#d4af37',
    };
    return colors[tier?.toLowerCase()] || '#d4af37';
  };

  if (loading) {
    return <div className="loyalty-dashboard loading">Loading loyalty data...</div>;
  }

  if (!loyaltyData) {
    return (
      <div className="loyalty-dashboard empty">
        <h2>Join Our Loyalty Program</h2>
        <p>Start earning points on every purchase!</p>
        <button className="btn-join">Join Now</button>
      </div>
    );
  }

  return (
    <div className="loyalty-dashboard">
      <div className="loyalty-header">
        <div className="loyalty-title">
          <h2>Loyalty & Rewards</h2>
          <div
            className="tier-badge"
            style={{ background: getTierColor(loyaltyData.current_tier) }}
          >
            {getTierBadge(loyaltyData.current_tier)} {loyaltyData.current_tier}
          </div>
        </div>
        <div className="program-name">
          {loyaltyData.loyalty_programs?.name || 'Rewards Program'}
        </div>
      </div>

      <div className="points-card">
        <div className="points-balance">
          <div className="points-label">Available Points</div>
          <div className="points-value">{loyaltyData.points_balance?.toLocaleString()}</div>
        </div>
        <div className="points-stats">
          <div className="stat">
            <span className="stat-label">Lifetime Points</span>
            <span className="stat-value">{loyaltyData.lifetime_points?.toLocaleString()}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Points Used</span>
            <span className="stat-value">{loyaltyData.points_redeemed?.toLocaleString()}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Member Since</span>
            <span className="stat-value">
              {new Date(loyaltyData.created_at).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>

      <div className="rewards-section">
        <h3>Available Rewards</h3>
        <div className="rewards-grid">
          {rewards.length === 0 ? (
            <p className="no-rewards">No rewards available at the moment</p>
          ) : (
            rewards.map((reward) => (
              <div key={reward.id} className="reward-card">
                <div className="reward-icon">🎁</div>
                <div className="reward-details">
                  <h4>{reward.name}</h4>
                  <p>{reward.description}</p>
                  <div className="reward-cost">
                    <span className="points-required">{reward.points_cost} points</span>
                    {reward.expiry_date && (
                      <span className="expiry-date">
                        Expires: {new Date(reward.expiry_date).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => {
                    setSelectedReward(reward);
                    setShowRedeemModal(true);
                  }}
                  disabled={loyaltyData.points_balance < reward.points_cost}
                  className={
                    loyaltyData.points_balance >= reward.points_cost
                      ? 'btn-redeem'
                      : 'btn-redeem disabled'
                  }
                >
                  {loyaltyData.points_balance >= reward.points_cost
                    ? 'Redeem'
                    : 'Insufficient Points'}
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="transactions-section">
        <h3>Recent Activity</h3>
        <div className="transactions-list">
          {transactions.length === 0 ? (
            <p className="empty-message">No activity yet</p>
          ) : (
            transactions.map((transaction) => (
              <div key={transaction.id} className="transaction-item">
                <div className="transaction-icon">
                  {transaction.points_earned > 0 ? '➕' : '➖'}
                </div>
                <div className="transaction-details">
                  <div className="transaction-description">{transaction.description}</div>
                  <div className="transaction-date">
                    {new Date(transaction.created_at).toLocaleString()}
                  </div>
                </div>
                <div
                  className={`transaction-points ${transaction.points_earned > 0 ? 'earned' : 'redeemed'}`}
                >
                  {transaction.points_earned > 0 ? '+' : '-'}
                  {Math.abs(transaction.points_earned || transaction.points_redeemed)} pts
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {showRedeemModal && selectedReward && (
        <div className="modal-overlay" onClick={() => setShowRedeemModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Redeem Reward</h3>
            <div className="reward-details-modal">
              <p>
                <strong>{selectedReward.name}</strong>
              </p>
              <p>{selectedReward.description}</p>
              <p className="points-cost-modal">Cost: {selectedReward.points_cost} points</p>
              <p>
                Your balance after redemption:{' '}
                {loyaltyData.points_balance - selectedReward.points_cost} points
              </p>
            </div>
            <div className="modal-actions">
              <button onClick={() => handleRedeemReward(selectedReward)} className="btn-confirm">
                Confirm Redemption
              </button>
              <button onClick={() => setShowRedeemModal(false)} className="btn-cancel">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

LoyaltyDashboard.propTypes = {
  customerId: PropTypes.string.isRequired,
};

export default LoyaltyDashboard;
