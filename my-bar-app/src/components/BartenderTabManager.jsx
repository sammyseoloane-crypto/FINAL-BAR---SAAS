import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import './BartenderTabManager.css';

export default function BartenderTabManager() {
  const [tenantId, setTenantId] = useState(null);
  const [openTabs, setOpenTabs] = useState([]);
  const [selectedTab, setSelectedTab] = useState(null);
  const [tabItems, setTabItems] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddDrink, setShowAddDrink] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Load tenant ID
  useEffect(() => {
    const loadTenant = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('tenant_id')
            .eq('id', user.id)
            .single();

          if (profile) {
            setTenantId(profile.tenant_id);
          }
        }
      } catch (error) {
        console.error('Error loading tenant:', error);
      }
    };
    loadTenant();
  }, []);

  // Load open tabs
  const loadOpenTabs = useCallback(async () => {
    if (!tenantId) {
      return;
    }

    try {
      const { data, error } = await supabase
        .rpc('get_open_tabs', { p_tenant_id: tenantId });

      if (error) {
        throw error;
      }
      setOpenTabs(data || []);
    } catch (error) {
      console.error('Error loading open tabs:', error);
    }
  }, [tenantId]);

  // Load products/drinks menu
  const loadProducts = useCallback(async () => {
    if (!tenantId) {
      return;
    }

    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('available', true)
        .order('name');

      if (error) {
        throw error;
      }
      setProducts(data || []);
    } catch (error) {
      console.error('Error loading products:', error);
    }
  }, [tenantId]);

  // Load tab items
  const loadTabItems = useCallback(async (tabId) => {
    try {
      const { data, error } = await supabase
        .from('tab_items')
        .select('*')
        .eq('tab_id', tabId)
        .not('status', 'in', '("removed","cancelled")')
        .order('added_at', { ascending: true });

      if (error) {
        throw error;
      }
      setTabItems(data || []);
    } catch (error) {
      console.error('Error loading tab items:', error);
    }
  }, []);

  // Initial load
  useEffect(() => {
    if (tenantId) {
      Promise.all([loadOpenTabs(), loadProducts()])
        .then(() => setLoading(false));
    }
  }, [tenantId, loadOpenTabs, loadProducts]);

  // Real-time subscriptions
  useEffect(() => {
    if (!tenantId) {
      return;
    }

    // Subscribe to tabs changes
    const tabsChannel = supabase
      .channel('bartender-tabs')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tabs',
        filter: `tenant_id=eq.${tenantId}`,
      }, () => {
        loadOpenTabs();
      })
      .subscribe();

    // Subscribe to tab items changes
    const itemsChannel = supabase
      .channel('bartender-tab-items')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tab_items',
        filter: `tenant_id=eq.${tenantId}`,
      }, () => {
        if (selectedTab) {
          loadTabItems(selectedTab.tab_id);
        }
        loadOpenTabs();
      })
      .subscribe();

    return () => {
      tabsChannel.unsubscribe();
      itemsChannel.unsubscribe();
    };
  }, [tenantId, selectedTab, loadOpenTabs, loadTabItems]);

  // Select tab
  const handleSelectTab = async (tab) => {
    setSelectedTab(tab);
    await loadTabItems(tab.tab_id);
    setShowAddDrink(false);
  };

  // Add drink to tab
  const handleAddDrink = async () => {
    if (!selectedTab || !selectedProduct || quantity < 1) {
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();

      const totalPrice = parseFloat(selectedProduct.price) * quantity;

      const { error } = await supabase
        .from('tab_items')
        .insert({
          tab_id: selectedTab.tab_id,
          tenant_id: tenantId,
          product_id: selectedProduct.id,
          drink_name: selectedProduct.name,
          drink_category: selectedProduct.type,
          quantity: quantity,
          unit_price: selectedProduct.price,
          total_price: totalPrice,
          special_instructions: specialInstructions || null,
          added_by: user?.id,
          status: 'ordered',
        });

      if (error) {
        throw error;
      }

      // Reset form
      setSelectedProduct(null);
      setQuantity(1);
      setSpecialInstructions('');
      setShowAddDrink(false);

      alert('Drink added successfully!');
    } catch (error) {
      console.error('Error adding drink:', error);
      alert('Error adding drink to tab');
    }
  };

  // Remove item from tab
  const handleRemoveItem = async (itemId) => {
    if (!confirm('Remove this item from the tab?')) {
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('tab_items')
        .update({
          status: 'removed',
          removed_by: user?.id,
          removed_at: new Date().toISOString(),
        })
        .eq('id', itemId);

      if (error) {
        throw error;
      }

      alert('Item removed from tab');
    } catch (error) {
      console.error('Error removing item:', error);
      alert('Error removing item');
    }
  };

  // Close tab
  const handleCloseTab = async (tabId) => {
    if (!confirm('Mark this tab as ready for payment? Customer will be notified.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('tabs')
        .update({
          status: 'payment_pending',
        })
        .eq('id', tabId);

      if (error) {
        throw error;
      }

      alert('Tab marked for payment. Customer can now pay.');
      setSelectedTab(null);
      setTabItems([]);
    } catch (error) {
      console.error('Error closing tab:', error);
      alert('Error closing tab');
    }
  };

  // Filter products
  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || product.type === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const categories = ['all', ...new Set(products.map(p => p.type))];

  if (loading) {
    return (
      <div className="bartender-tab-manager">
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bartender-tab-manager">
      <div className="manager-header">
        <h1>🍹 Tab Manager</h1>
        <div className="header-stats">
          <div className="stat-badge">
            <span className="stat-value">{openTabs.length}</span>
            <span className="stat-label">Open Tabs</span>
          </div>
        </div>
      </div>

      <div className="manager-content">
        {/* Open Tabs List */}
        <div className="tabs-list-section">
          <h2>Open Tabs</h2>
          {openTabs.length === 0 ? (
            <div className="no-tabs">
              <p>No open tabs at the moment</p>
            </div>
          ) : (
            <div className="tabs-grid">
              {openTabs.map((tab) => (
                <div
                  key={tab.tab_id}
                  className={`tab-card ${selectedTab?.tab_id === tab.tab_id ? 'selected' : ''}`}
                  onClick={() => handleSelectTab(tab)}
                >
                  <div className="tab-card-header">
                    <h3>{tab.customer_name}</h3>
                    {tab.table_name && <span className="table-badge">{tab.table_name}</span>}
                  </div>
                  <div className="tab-card-stats">
                    <div className="stat">
                      <span className="stat-icon">🍸</span>
                      <span>{tab.item_count} items</span>
                    </div>
                    <div className="stat">
                      <span className="stat-icon">💰</span>
                      <span>R{parseFloat(tab.tab_total).toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="tab-card-time">
                    Open for {tab.minutes_open} minutes
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Selected Tab Details */}
        {selectedTab && (
          <div className="tab-details-section">
            <div className="tab-details-header">
              <div>
                <h2>{selectedTab.customer_name}&apos;s Tab</h2>
                <p className="table-info">{selectedTab.table_name}</p>
              </div>
              <button
                onClick={() => handleCloseTab(selectedTab.tab_id)}
                className="btn-close-tab"
                disabled={tabItems.length === 0}
              >
                Ready for Payment
              </button>
            </div>

            {/* Tab Items */}
            <div className="tab-items-list">
              <h3>Items ({tabItems.length})</h3>
              {tabItems.length === 0 ? (
                <div className="no-items">
                  <p>No items yet</p>
                </div>
              ) : (
                <div className="items-list">
                  {tabItems.map((item) => (
                    <div key={item.id} className="item-row">
                      <div className="item-details">
                        <span className="item-name">{item.drink_name}</span>
                        {item.special_instructions && (
                          <span className="item-notes">{item.special_instructions}</span>
                        )}
                      </div>
                      <div className="item-quantity">×{item.quantity}</div>
                      <div className="item-price">R{parseFloat(item.total_price).toFixed(2)}</div>
                      <button
                        onClick={() => handleRemoveItem(item.id)}
                        className="btn-remove-item"
                        title="Remove item"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="tab-total">
                <span>Total:</span>
                <span className="total-amount">R{parseFloat(selectedTab.tab_total).toFixed(2)}</span>
              </div>
            </div>

            {/* Add Drink Button */}
            <button
              onClick={() => setShowAddDrink(!showAddDrink)}
              className="btn-add-drink"
            >
              {showAddDrink ? 'Cancel' : '+ Add Drink'}
            </button>

            {/* Add Drink Form */}
            {showAddDrink && (
              <div className="add-drink-form">
                <h3>Add Drink to Tab</h3>

                {/* Search and Filter */}
                <div className="search-bar">
                  <input
                    type="text"
                    placeholder="Search drinks..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="search-input"
                  />
                </div>

                <div className="category-filters">
                  {categories.map(cat => (
                    <button
                      key={cat}
                      onClick={() => setCategoryFilter(cat)}
                      className={`category-btn ${categoryFilter === cat ? 'active' : ''}`}
                    >
                      {cat === 'all' ? 'All' : cat}
                    </button>
                  ))}
                </div>

                {/* Products Grid */}
                <div className="products-grid">
                  {filteredProducts.map((product) => (
                    <div
                      key={product.id}
                      className={`product-card ${selectedProduct?.id === product.id ? 'selected' : ''}`}
                      onClick={() => setSelectedProduct(product)}
                    >
                      <div className="product-name">{product.name}</div>
                      <div className="product-price">R{parseFloat(product.price).toFixed(2)}</div>
                      {product.type && <div className="product-type">{product.type}</div>}
                    </div>
                  ))}
                </div>

                {/* Selected Product Details */}
                {selectedProduct && (
                  <div className="selected-product-form">
                    <h4>{selectedProduct.name}</h4>

                    <div className="form-group">
                      <label>Quantity</label>
                      <input
                        type="number"
                        min="1"
                        value={quantity}
                        onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                        className="quantity-input"
                      />
                    </div>

                    <div className="form-group">
                      <label>Special Instructions (optional)</label>
                      <textarea
                        value={specialInstructions}
                        onChange={(e) => setSpecialInstructions(e.target.value)}
                        placeholder="e.g., No ice, extra lime"
                        className="instructions-input"
                        rows="2"
                      />
                    </div>

                    <div className="form-total">
                      Total: R{(parseFloat(selectedProduct.price) * quantity).toFixed(2)}
                    </div>

                    <button onClick={handleAddDrink} className="btn-confirm-add">
                      Add to Tab
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {!selectedTab && (
          <div className="no-selection">
            <p>← Select a tab to manage</p>
          </div>
        )}
      </div>
    </div>
  );
}
