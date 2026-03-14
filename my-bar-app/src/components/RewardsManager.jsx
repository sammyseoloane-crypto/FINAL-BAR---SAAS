/**
 * Rewards Manager Component
 * Admin interface for managing rewards catalog and loyalty programs
 */

import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { supabase } from '../supabaseClient';
import './RewardsManager.css';

function RewardsManager({ tenantId }) {
  const [rewards, setRewards] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showRewardForm, setShowRewardForm] = useState(false);
  const [showProgramForm, setShowProgramForm] = useState(false);
  const [editingReward, setEditingReward] = useState(null);
  const [editingProgram, setEditingProgram] = useState(null);

  const [rewardForm, setRewardForm] = useState({
    name: '',
    description: '',
    points_cost: 0,
    reward_type: 'discount',
    discount_percentage: 0,
    expiry_date: '',
    active: true,
  });

  const [programForm, setProgramForm] = useState({
    name: '',
    description: '',
    points_per_dollar: 1,
    points_per_visit: 0,
    tier_system: {},
    active: true,
  });

  useEffect(() => {
    if (tenantId) {
      fetchRewards();
      fetchPrograms();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  const fetchRewards = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('rewards_catalog')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }
      setRewards(data || []);
    } catch (error) {
      console.error('Error fetching rewards:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPrograms = async () => {
    try {
      const { data, error } = await supabase
        .from('loyalty_programs')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }
      setPrograms(data || []);
    } catch (error) {
      console.error('Error fetching programs:', error);
    }
  };

  const handleSaveReward = async (e) => {
    e.preventDefault();

    try {
      const rewardData = {
        ...rewardForm,
        tenant_id: tenantId,
        points_cost: parseInt(rewardForm.points_cost),
        discount_percentage: parseFloat(rewardForm.discount_percentage) || null,
        expiry_date: rewardForm.expiry_date || null,
      };

      if (editingReward) {
        const { error } = await supabase
          .from('rewards_catalog')
          .update(rewardData)
          .eq('id', editingReward.id);

        if (error) {
          throw error;
        }
      } else {
        const { error } = await supabase.from('rewards_catalog').insert([rewardData]);

        if (error) {
          throw error;
        }
      }

      fetchRewards();
      handleCloseRewardForm();
    } catch (error) {
      console.error('Error saving reward:', error);
      alert('Failed to save reward');
    }
  };

  const handleSaveProgram = async (e) => {
    e.preventDefault();

    try {
      const programData = {
        ...programForm,
        tenant_id: tenantId,
        points_per_dollar: parseFloat(programForm.points_per_dollar),
        points_per_visit: parseInt(programForm.points_per_visit),
      };

      if (editingProgram) {
        const { error } = await supabase
          .from('loyalty_programs')
          .update(programData)
          .eq('id', editingProgram.id);

        if (error) {
          throw error;
        }
      } else {
        const { error } = await supabase.from('loyalty_programs').insert([programData]);

        if (error) {
          throw error;
        }
      }

      fetchPrograms();
      handleCloseProgramForm();
    } catch (error) {
      console.error('Error saving program:', error);
      alert('Failed to save program');
    }
  };

  const handleDeleteReward = async (rewardId) => {
    if (!confirm('Are you sure you want to delete this reward?')) {
      return;
    }

    try {
      const { error } = await supabase.from('rewards_catalog').delete().eq('id', rewardId);

      if (error) {
        throw error;
      }
      fetchRewards();
    } catch (error) {
      console.error('Error deleting reward:', error);
      alert('Failed to delete reward');
    }
  };

  const handleDeleteProgram = async (programId) => {
    if (
      !confirm('Are you sure you want to delete this program? This may affect existing customers.')
    ) {
      return;
    }

    try {
      const { error } = await supabase.from('loyalty_programs').delete().eq('id', programId);

      if (error) {
        throw error;
      }
      fetchPrograms();
    } catch (error) {
      console.error('Error deleting program:', error);
      alert('Failed to delete program');
    }
  };

  const handleEditReward = (reward) => {
    setEditingReward(reward);
    setRewardForm({
      name: reward.name,
      description: reward.description,
      points_cost: reward.points_cost,
      reward_type: reward.reward_type,
      discount_percentage: reward.discount_percentage || 0,
      expiry_date: reward.expiry_date ? reward.expiry_date.split('T')[0] : '',
      active: reward.active,
    });
    setShowRewardForm(true);
  };

  const handleEditProgram = (program) => {
    setEditingProgram(program);
    setProgramForm({
      name: program.name,
      description: program.description,
      points_per_dollar: program.points_per_dollar,
      points_per_visit: program.points_per_visit,
      tier_system: program.tier_system || {},
      active: program.active,
    });
    setShowProgramForm(true);
  };

  const handleCloseRewardForm = () => {
    setShowRewardForm(false);
    setEditingReward(null);
    setRewardForm({
      name: '',
      description: '',
      points_cost: 0,
      reward_type: 'discount',
      discount_percentage: 0,
      expiry_date: '',
      active: true,
    });
  };

  const handleCloseProgramForm = () => {
    setShowProgramForm(false);
    setEditingProgram(null);
    setProgramForm({
      name: '',
      description: '',
      points_per_dollar: 1,
      points_per_visit: 0,
      tier_system: {},
      active: true,
    });
  };

  if (loading) {
    return <div className="rewards-manager loading">Loading rewards...</div>;
  }

  return (
    <div className="rewards-manager">
      <div className="manager-header">
        <h2>Loyalty & Rewards Manager</h2>
      </div>

      <div className="manager-sections">
        {/* Programs Section */}
        <div className="section programs-section">
          <div className="section-header">
            <h3>Loyalty Programs</h3>
            <button onClick={() => setShowProgramForm(true)} className="btn-add">
              + New Program
            </button>
          </div>
          <div className="programs-list">
            {programs.length === 0 ? (
              <p className="empty-message">No loyalty programs created yet</p>
            ) : (
              programs.map((program) => (
                <div key={program.id} className="program-card">
                  <div className="program-info">
                    <h4>{program.name}</h4>
                    <p>{program.description}</p>
                    <div className="program-details">
                      <span>💵 {program.points_per_dollar} pts/$</span>
                      <span>📍 {program.points_per_visit} pts/visit</span>
                      <span className={program.active ? 'status active' : 'status inactive'}>
                        {program.active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                  <div className="program-actions">
                    <button onClick={() => handleEditProgram(program)} className="btn-edit">
                      Edit
                    </button>
                    <button onClick={() => handleDeleteProgram(program.id)} className="btn-delete">
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Rewards Catalog Section */}
        <div className="section rewards-section">
          <div className="section-header">
            <h3>Rewards Catalog</h3>
            <button onClick={() => setShowRewardForm(true)} className="btn-add">
              + New Reward
            </button>
          </div>
          <div className="rewards-table">
            {rewards.length === 0 ? (
              <p className="empty-message">No rewards created yet</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Reward</th>
                    <th>Type</th>
                    <th>Points Cost</th>
                    <th>Discount</th>
                    <th>Expiry</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rewards.map((reward) => (
                    <tr key={reward.id}>
                      <td>
                        <div className="reward-name">{reward.name}</div>
                        <div className="reward-desc">{reward.description}</div>
                      </td>
                      <td>
                        <span className={`type-badge ${reward.reward_type}`}>
                          {reward.reward_type}
                        </span>
                      </td>
                      <td>{reward.points_cost}</td>
                      <td>{reward.discount_percentage ? `${reward.discount_percentage}%` : '-'}</td>
                      <td>
                        {reward.expiry_date
                          ? new Date(reward.expiry_date).toLocaleDateString()
                          : 'No expiry'}
                      </td>
                      <td>
                        <span className={reward.active ? 'status active' : 'status inactive'}>
                          {reward.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button
                            onClick={() => handleEditReward(reward)}
                            className="btn-edit-small"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteReward(reward.id)}
                            className="btn-delete-small"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Reward Form Modal */}
      {showRewardForm && (
        <div className="modal-overlay" onClick={handleCloseRewardForm}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>{editingReward ? 'Edit Reward' : 'Create New Reward'}</h3>
            <form onSubmit={handleSaveReward}>
              <div className="form-group">
                <label>Reward Name *</label>
                <input
                  type="text"
                  value={rewardForm.name}
                  onChange={(e) => setRewardForm({ ...rewardForm, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Description *</label>
                <textarea
                  value={rewardForm.description}
                  onChange={(e) => setRewardForm({ ...rewardForm, description: e.target.value })}
                  required
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Points Cost *</label>
                  <input
                    type="number"
                    value={rewardForm.points_cost}
                    onChange={(e) => setRewardForm({ ...rewardForm, points_cost: e.target.value })}
                    required
                    min="0"
                  />
                </div>
                <div className="form-group">
                  <label>Reward Type *</label>
                  <select
                    value={rewardForm.reward_type}
                    onChange={(e) => setRewardForm({ ...rewardForm, reward_type: e.target.value })}
                    required
                  >
                    <option value="discount">Discount</option>
                    <option value="free_item">Free Item</option>
                    <option value="cashback">Cashback</option>
                    <option value="gift">Gift</option>
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Discount Percentage (if applicable)</label>
                  <input
                    type="number"
                    value={rewardForm.discount_percentage}
                    onChange={(e) =>
                      setRewardForm({ ...rewardForm, discount_percentage: e.target.value })
                    }
                    min="0"
                    max="100"
                  />
                </div>
                <div className="form-group">
                  <label>Expiry Date (optional)</label>
                  <input
                    type="date"
                    value={rewardForm.expiry_date}
                    onChange={(e) => setRewardForm({ ...rewardForm, expiry_date: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-group checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    checked={rewardForm.active}
                    onChange={(e) => setRewardForm({ ...rewardForm, active: e.target.checked })}
                  />
                  Active
                </label>
              </div>
              <div className="modal-actions">
                <button type="submit" className="btn-save">
                  {editingReward ? 'Update' : 'Create'}
                </button>
                <button type="button" onClick={handleCloseRewardForm} className="btn-cancel">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Program Form Modal */}
      {showProgramForm && (
        <div className="modal-overlay" onClick={handleCloseProgramForm}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>{editingProgram ? 'Edit Program' : 'Create New Program'}</h3>
            <form onSubmit={handleSaveProgram}>
              <div className="form-group">
                <label>Program Name *</label>
                <input
                  type="text"
                  value={programForm.name}
                  onChange={(e) => setProgramForm({ ...programForm, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Description *</label>
                <textarea
                  value={programForm.description}
                  onChange={(e) => setProgramForm({ ...programForm, description: e.target.value })}
                  required
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Points per Dollar *</label>
                  <input
                    type="number"
                    step="0.1"
                    value={programForm.points_per_dollar}
                    onChange={(e) =>
                      setProgramForm({ ...programForm, points_per_dollar: e.target.value })
                    }
                    required
                    min="0"
                  />
                </div>
                <div className="form-group">
                  <label>Points per Visit</label>
                  <input
                    type="number"
                    value={programForm.points_per_visit}
                    onChange={(e) =>
                      setProgramForm({ ...programForm, points_per_visit: e.target.value })
                    }
                    min="0"
                  />
                </div>
              </div>
              <div className="form-group checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    checked={programForm.active}
                    onChange={(e) => setProgramForm({ ...programForm, active: e.target.checked })}
                  />
                  Active
                </label>
              </div>
              <div className="modal-actions">
                <button type="submit" className="btn-save">
                  {editingProgram ? 'Update' : 'Create'}
                </button>
                <button type="button" onClick={handleCloseProgramForm} className="btn-cancel">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

RewardsManager.propTypes = {
  tenantId: PropTypes.string.isRequired,
};

export default RewardsManager;
