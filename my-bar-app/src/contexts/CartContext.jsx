import { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../supabaseClient';

const CartContext = createContext({});

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

export const CartProvider = ({ children }) => {
  const { user, userProfile } = useAuth();
  const [cartItems, setCartItems] = useState([]);
  const [loading, setLoading] = useState(false);

  // Load cart from database on mount
  useEffect(() => {
    if (user && userProfile) {
      loadCartFromDB();
    } else {
      setCartItems([]);
    }
  }, [user, userProfile]);

  const loadCartFromDB = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('cart_items')
        .select(
          `
          id,
          quantity,
          price,
          product_id,
          event_id,
          products!product_id (id, name, price, type, image_url, available),
          events!event_id (id, name, entry_fee, date, active)
        `,
        )
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      // Transform database format to cart format
      const transformedCart = data.map((item) => {
        if (item.product_id) {
          return {
            id: item.products.id,
            name: item.products.name,
            price: item.products.price,
            type: 'product',
            productType: item.products.type,  // Add productType from products table
            image_url: item.products.image_url,
            available: item.products.available,
            quantity: item.quantity,
            cart_item_id: item.id,
          };
        } else {
          return {
            id: item.events.id,
            name: item.events.name,
            price: item.events.entry_fee,
            type: 'event',
            date: item.events.date,
            active: item.events.active,
            quantity: item.quantity,
            cart_item_id: item.id,
          };
        }
      });

      setCartItems(transformedCart);
    } catch (error) {
      console.error('Error loading cart:', error);
    } finally {
      setLoading(false);
    }
  };

  const addToCart = async (item, quantityToAdd = 1) => {
    if (!user || !userProfile) {
      console.error('User must be logged in to add to cart');
      return;
    }

    try {
      // Check if item already exists in cart
      const existingItem = cartItems.find(
        (cartItem) => cartItem.id === item.id && cartItem.type === item.type,
      );

      if (existingItem) {
        // Update quantity in database
        const newQuantity = existingItem.quantity + quantityToAdd;
        const { error } = await supabase
          .from('cart_items')
          .update({ quantity: newQuantity })
          .eq('id', existingItem.cart_item_id);

        if (error) {
          throw error;
        }

        // Update local state
        setCartItems((prevItems) =>
          prevItems.map((cartItem) =>
            cartItem.cart_item_id === existingItem.cart_item_id
              ? { ...cartItem, quantity: newQuantity }
              : cartItem,
          ),
        );
      } else {
        // Insert new cart item
        const { data, error } = await supabase
          .from('cart_items')
          .insert({
            user_id: user.id,
            tenant_id: userProfile.tenant_id,
            product_id: item.type === 'product' ? item.id : null,
            event_id: item.type === 'event' ? item.id : null,
            quantity: quantityToAdd,
            price: item.price,
          })
          .select()
          .single();

        if (error) {
          throw error;
        }

        // Add to local state
        setCartItems((prevItems) => [
          ...prevItems,
          { ...item, quantity: quantityToAdd, cart_item_id: data.id },
        ]);
      }
    } catch (error) {
      console.error('Error adding to cart:', error);
      alert('Failed to add item to cart');
    }
  };

  const removeFromCart = async (itemId, itemType) => {
    try {
      const item = cartItems.find(
        (cartItem) => cartItem.id === itemId && cartItem.type === itemType,
      );

      if (!item) {
        return;
      }

      const { error } = await supabase.from('cart_items').delete().eq('id', item.cart_item_id);

      if (error) {
        throw error;
      }

      setCartItems(cartItems.filter((cartItem) => cartItem.cart_item_id !== item.cart_item_id));
    } catch (error) {
      console.error('Error removing from cart:', error);
      alert('Failed to remove item from cart');
    }
  };

  const updateQuantity = async (itemId, itemType, newQuantity) => {
    if (newQuantity <= 0) {
      removeFromCart(itemId, itemType);
      return;
    }

    try {
      const item = cartItems.find(
        (cartItem) => cartItem.id === itemId && cartItem.type === itemType,
      );

      if (!item) {
        return;
      }

      const { error } = await supabase
        .from('cart_items')
        .update({ quantity: newQuantity })
        .eq('id', item.cart_item_id);

      if (error) {
        throw error;
      }

      setCartItems(
        cartItems.map((cartItem) =>
          cartItem.cart_item_id === item.cart_item_id
            ? { ...cartItem, quantity: newQuantity }
            : cartItem,
        ),
      );
    } catch (error) {
      console.error('Error updating quantity:', error);
      alert('Failed to update quantity');
    }
  };

  const clearCart = async () => {
    if (!user) {
      return;
    }

    try {
      const { error } = await supabase.from('cart_items').delete().eq('user_id', user.id);

      if (error) {
        throw error;
      }

      setCartItems([]);
    } catch (error) {
      console.error('Error clearing cart:', error);
      // Clear local state anyway
      setCartItems([]);
    }
  };

  const getCartTotal = () => {
    return cartItems.reduce((total, item) => total + item.price * item.quantity, 0);
  };

  const getCartCount = () => {
    return cartItems.reduce((count, item) => count + item.quantity, 0);
  };

  const value = {
    cartItems,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    getCartTotal,
    getCartCount,
    loading,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};
