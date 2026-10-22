document.addEventListener('DOMContentLoaded', () => {
    let customProperties = {};
    function additionalProducts(el) {
        //获取当前el下的每个additional-products__item元素，绑定点击事件，
        //当点击当前的additional-products__item元素的时候，当前元素添加自定义属性checked
        const items = el.querySelectorAll('.additional-products__item');
        //获取el的子元素input
        const input = el.parentNode.querySelector('.additional-products__input');
        items.forEach(item => {
            item.addEventListener('click', () => {
                // 先移除所有元素的 checked 属性
                items.forEach(i => {
                    if (i !== item) {
                        i.removeAttribute('checked');
                    }
                });
                // 如果当前元素没有 checked 属性，则添加 checked
                if (!item.hasAttribute('checked')) {
                    item.setAttribute('checked', true);
                    //获取item下的additional-products__item-title元素的文本内容
                    input.value = item.querySelector('.additional-products__item-title').innerText;
                    //获取input的name属性
                    const key = getKey(input.name);
                    //将key和input.value添加到customProperties中
                    customProperties[key] = input.value;
                } else {
                    item.removeAttribute('checked');
                    input.value = '';
                }
            });
        });
    }
    additionalProducts(document.querySelector('.additional-products__outer-list'));
    additionalProducts(document.querySelector('.additional-products__inner-list'));

    //获取buy-buttons下type=submit的button元素
    const submitButton = document.querySelector('.product-info__buy-buttons button[type="submit"]');
    submitButton.addEventListener('click', () => {
        createAdditionalProducts()
    })
    function createAdditionalProducts() {
        //获取所有checked状态的additional-products__item元素
        const checkedItems = document.querySelectorAll('.additional-products__item[checked]');
        if (checkedItems.length === 0) {
            return;
        }
        //计算checkedItems内每个元素的 additional-products__item-price的总和
        let totalPrice = 0;
        checkedItems.forEach(item => {
            totalPrice += convertCurrencyToNumber(item.querySelector('.additional-products__item-price').innerText);
        })
        const shopUrl = 'tes-ebike.myshopify.com'; // 用你的商店域名替换
        const accessToken = '';  // 用你获得的访问令牌替换
        const productData = {
            product: {
                body_html: "<strong>This is a new virtual product</strong>",  // 产品描述
                vendor: "MyVendor",  // 供应商
                product_type: "Virtual",  // 产品类型
                title: "My Product",  // 产品标题
                variants: [{
                    option1: "Default Title",  // 默认选项标题
                    price: totalPrice,  // 产品价格
                    sku: "VIRTUAL123",  // 库存单位 SKU
                    inventory_quantity: 1,  // 库存数量
                }],
            }
        }
        // 发送 POST 请求以创建产品
        fetch(`https://${shopUrl}/admin/api/2024-10/products.json`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Shopify-Access-Token': accessToken
            },
            body: JSON.stringify(productData)
        })
            .then(response => response.json())
            .then(data => {
                // 获取创建的产品的id
                const variantId = data.product.variants[0].id;
                addToCart(variantId, 1).then(() => {
                    updateCart();  // 确保 addToCart 完成后再更新购物车
                });
            })
            .catch(error => console.error('Error:', error));
    }
    function convertCurrencyToNumber(currencyString) {
        // 去除所有非数字字符（除了小数点和负号）
        return parseFloat(currencyString.replace(/[^0-9.-]+/g, ''));
    }
    async function addToCart(variantId, quantity) {
        const url = '/cart/add.js';
        const data = {
            items: [
                {
                    id: variantId,  // 变体 ID
                    quantity: quantity,  // 数量
                    properties: customProperties,  // 自定义属性
                }
            ]
        };

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data), // 将数据转换为 JSON 格式
            });

            if (response.ok) {
                const cart = await response.json();  // 获取响应的 JSON 数据
                updateCart();
                return cart;  // 返回更新后的购物车信息
            } else {
                console.error('Failed to add item to cart', response.statusText);
            }
        } catch (error) {
            console.error('Error adding item to cart:', error);
        }
    }
    function getKey(name) {
        const matches = name.match(/\[([^\]]+)\]/);
        // 获取 matches 的第一个捕获组，即 additional_products_outer
        const key = matches ? matches[1] : null;
        return key;
    }
    function updateCart() {
        fetch(`${Shopify.routes.root}cart/update.js`, {
            method: "POST",
        })
        .then(response => response.json())
        .then(data => {
            console.log('Cart updated:', data);
        })
        .catch(error => console.error('Error updating cart:', error));
    }

})
