// API Keys - Replace with your own in config.js
const API_KEYS = [
    '8CrzbJm2QCNPc7RYOakfB2CCf1qUlgR1k2RIZTGF',
    '6dTAN2kg97wCfpmyusSSc94dXOUUq0Qm6fqKXjlL',
    'MtZHulISDcb3l7qAZb2hzOD5FjxhXNYMk0LdUoaM',
    'SnplPUdjQp8tghL3MtyMTSSDwa85Z0xvFBhG9I1F',
    'FZAHr4vqIst6OFBh6BagcY5Xe0X1H2JrEE549ukf',
    'bWFXfjppVefLVVpHHUpiy3hitffjVgSdltDEwUZI',
    'F8g0fbfSAfWNYCgabwCbyhup3Xz2DN4JTvq8Thhu',
    'vTpWvBym2U7mH1dycFRfvLq8UcUmPDug5phMr96W',
    'MtZHulISDcb3l7qAZb2hzOD5FjxhXNYMk0LdUoaM'
];

let currentKeyIndex = 0;
let dailyFoods = JSON.parse(localStorage.getItem('dailyFoods') || '[]');
let debounceTimer;
let allFoods = [];

document.addEventListener('DOMContentLoaded', () => {
    const foodSearchInput = document.getElementById('foodSearch');
    const minCaloriesInput = document.getElementById('minCalories');
    const maxCaloriesInput = document.getElementById('maxCalories');
    
    // Load initial common foods
    searchFood('apple');

    // Add event listeners for filters
    foodSearchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            const searchTerm = e.target.value.trim();
            if (searchTerm) {
                searchFood(searchTerm);
            } else {
                filterAndDisplayFoods();
            }
        }, 300);
    });

    minCaloriesInput.addEventListener('input', filterAndDisplayFoods);
    maxCaloriesInput.addEventListener('input', filterAndDisplayFoods);

    updateFoodList();
    updateTotalNutrients();
});

async function searchFood(query, retryCount = 0) {
    const resultsDiv = document.getElementById('searchResults');
    resultsDiv.innerHTML = '<div class="text-center">Searching...</div>';
    
    try {
        // Only search if query is at least 4 characters
        if (query.length < 4) {
            resultsDiv.innerHTML = '<div class="alert alert-info">Please enter at least 4 characters to search.</div>';
            return;
        }

        // Remove any special characters and extra spaces
        query = query.trim().replace(/[^\w\s]/gi, '');

        const searchResponse = await fetch(`https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${API_KEYS[currentKeyIndex]}&query=${encodeURIComponent(query)}&pageSize=50&dataType=Foundation,SR Legacy,Survey (FNDDS)&sortBy=dataType.keyword&sortOrder=asc`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });

        if (!searchResponse.ok) {
            if (searchResponse.status === 429 || searchResponse.status === 401 || searchResponse.status === 403) {
                // Rate limit exceeded or invalid key, try next key
                currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
                
                if (retryCount < API_KEYS.length) {
                    // Retry with next key
                    return searchFood(query, retryCount + 1);
                } else {
                    throw new Error('All API keys are rate limited. Please try again in a few seconds.');
                }
            }
            throw new Error(`API error: ${searchResponse.status}`);
        }

        const searchData = await searchResponse.json();
        
        if (!searchData.foods || searchData.foods.length === 0) {
            resultsDiv.innerHTML = '<div class="alert alert-info">No foods found. Try a different search term.</div>';
            return;
        }

        // Process each food item
        const newFoods = searchData.foods.map(food => {
            const getNutrientValue = (nutrientName) => {
                const nutrient = food.foodNutrients.find(n => 
                    n.nutrientName && n.nutrientName.toLowerCase().includes(nutrientName.toLowerCase()) ||
                    n.nutrient && n.nutrient.name && n.nutrient.name.toLowerCase().includes(nutrientName.toLowerCase())
                );
                return nutrient ? (nutrient.amount || nutrient.value || 0) : 0;
            };

            const calories = getNutrientValue('Energy');
            const protein = getNutrientValue('Protein');
            const carbs = getNutrientValue('Carbohydrate');
            const fat = getNutrientValue('Fat');

            return {
                name: food.description,
                calories: Math.round(calories),
                protein: Math.round(protein * 10) / 10,
                carbs: Math.round(carbs * 10) / 10,
                fat: Math.round(fat * 10) / 10,
                serving_size: 100,
                serving_unit: "g",
                details: food.foodCategory || ''
            };
        });

        // Filter out foods with no calories and update allFoods
        allFoods = newFoods.filter(food => food.calories > 0);
        filterAndDisplayFoods();
    } catch (error) {
        console.error('Error searching for food:', error);
        resultsDiv.innerHTML = `
            <div class="alert alert-danger">
                <h5>Error</h5>
                <p>${error.message}</p>
                <button class="btn btn-primary btn-sm mt-2" onclick="searchFood('${query}')">Try Again</button>
            </div>
        `;
    }
}

function filterAndDisplayFoods() {
    const minCalories = parseFloat(document.getElementById('minCalories').value) || 0;
    const maxCalories = parseFloat(document.getElementById('maxCalories').value) || Infinity;

    // Apply filters
    const filteredFoods = allFoods.filter(food => {
        const matchesCalories = food.calories >= minCalories && 
                              (maxCalories === Infinity || food.calories <= maxCalories);
        return matchesCalories;
    });

    displaySearchResults(filteredFoods);
}

function displaySearchResults(foods) {
    const resultsDiv = document.getElementById('searchResults');
    resultsDiv.innerHTML = '';
    
    if (foods.length === 0) {
        resultsDiv.innerHTML = '<div class="text-center">No foods found matching your criteria.</div>';
        return;
    }
    
    foods.forEach(food => {
        const div = document.createElement('div');
        div.className = 'list-group-item search-result';
        
        // Create quantity input
        const quantityInput = document.createElement('div');
        quantityInput.className = 'input-group mb-2';
        quantityInput.innerHTML = `
            <input type="number" class="form-control quantity-input" value="${food.serving_size}" min="0.1" step="0.1">
            <span class="input-group-text">${food.serving_unit}</span>
        `;
        
        // Create food info
        const foodInfo = document.createElement('div');
        foodInfo.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
                <div>
                    <h6 class="mb-0">${food.name}</h6>
                    <small class="text-muted">${food.details}</small>
                    <div class="nutrients-info">
                        <small class="text-muted">
                            Per ${food.serving_size}${food.serving_unit}: 
                            Calories: ${Math.round(food.calories)} | 
                            Carbs: ${Math.round(food.carbs)}g | 
                            Protein: ${Math.round(food.protein)}g | 
                            Fat: ${Math.round(food.fat)}g
                        </small>
                    </div>
                </div>
                <button class="btn btn-primary btn-sm">Add</button>
            </div>
        `;
        
        div.appendChild(quantityInput);
        div.appendChild(foodInfo);
        
        // Add button click handler
        const addButton = foodInfo.querySelector('button');
        const qtyInput = quantityInput.querySelector('input');
        
        addButton.addEventListener('click', () => {
            const quantity = parseFloat(qtyInput.value);
            const multiplier = quantity / food.serving_size;
            
            const adjustedFood = {
                description: `${quantity}${food.serving_unit} ${food.name}`,
                calories: Math.round(food.calories * multiplier * 10) / 10,
                carbs: Math.round(food.carbs * multiplier * 10) / 10,
                protein: Math.round(food.protein * multiplier * 10) / 10,
                fat: Math.round(food.fat * multiplier * 10) / 10,
                serving_size: quantity,
                serving_unit: food.serving_unit
            };
            
            addFoodToDaily(adjustedFood);
        });
        
        resultsDiv.appendChild(div);
    });
}

function addFoodToDaily(food) {
    dailyFoods.push(food);
    localStorage.setItem('dailyFoods', JSON.stringify(dailyFoods));
    updateFoodList();
    updateTotalNutrients();
    document.getElementById('foodSearch').value = '';
}

function updateFoodList() {
    const foodListDiv = document.getElementById('foodList');
    foodListDiv.innerHTML = '';
    
    dailyFoods.forEach((food, index) => {
        const div = document.createElement('div');
        div.className = 'list-group-item food-item';
        div.innerHTML = `
            <div class="d-flex align-items-center">
                <div>
                    <h6 class="mb-0">${food.description}</h6>
                    <div class="nutrients-info">
                        <small class="text-muted">
                            Calories: ${food.calories} | 
                            Carbs: ${food.carbs}g | 
                            Protein: ${food.protein}g | 
                            Fat: ${food.fat}g
                        </small>
                    </div>
                </div>
                <button class="btn btn-sm btn-danger ms-auto" onclick="removeFood(${index})">×</button>
            </div>
        `;
        foodListDiv.appendChild(div);
    });
}

function updateTotalNutrients() {
    let totalCalories = 0;
    let totalCarbs = 0;
    let totalProtein = 0;
    let totalFat = 0;
    
    dailyFoods.forEach(food => {
        totalCalories += food.calories;
        totalCarbs += food.carbs;
        totalProtein += food.protein;
        totalFat += food.fat;
    });
    
    document.getElementById('totalCalories').textContent = Math.round(totalCalories);
    document.getElementById('totalCarbs').textContent = Math.round(totalCarbs);
    document.getElementById('totalProtein').textContent = Math.round(totalProtein);
    document.getElementById('totalFat').textContent = Math.round(totalFat);
}

function removeFood(index) {
    dailyFoods.splice(index, 1);
    localStorage.setItem('dailyFoods', JSON.stringify(dailyFoods));
    updateFoodList();
    updateTotalNutrients();
}
