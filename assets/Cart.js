// Cart.js
import React, { useState, useEffect } from 'react';

const Cart = ({ initialCart }) => {
    const [cart, setCart] = useState(initialCart);

    const updateCart = (item) => {
        // 添加/删除商品的逻辑
        setCart((prevCart) => ({
            ...prevCart,
            items: [...prevCart.items, item], // 示例逻辑
            total: prevCart.total + item.price, // 示例逻辑
        }));
    };

    return (
        <div>
            <h2>Shopping Cart</h2>
            {cart.items.map((item) => (
                <div key={item.id}>
                    <span>{item.name}</span>
                    <span>{item.price}</span>
                    <button onClick={() => updateCart(item)}>Remove</button>
                </div>
            ))}
            <div>Total: {cart.total}</div>
            <div>{cart.total >= 50 ? 'Free Shipping!' : 'Add more items for free shipping!'}</div>
        </div>
    );
};

export default Cart;
