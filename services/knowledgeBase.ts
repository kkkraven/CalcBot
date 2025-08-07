import { FormData } from '../types';

export interface OrderRecord {
  id: string;
  productType: string;
  specificType?: string;
  quantity: number;
  pricePerUnit: number;
  width?: number;
  height?: number;
  depth?: number;
  material: string;
  materialDensity?: number;
  printColorsOuter?: string;
  printColorsInner?: string;
  printType?: string;
  finishes?: string[];
  handleType?: string;
  handleAttachment?: string;
  fittings?: string;
  notes?: string;
  createdAt: Date;
  actualPrice?: number; // Реальная цена после выполнения заказа
  supplier?: string;
}

class KnowledgeBase {
  private orders: OrderRecord[] = [];
  private readonly STORAGE_KEY = 'packaging_orders_db';

  constructor() {
    this.loadFromStorage();
  }

  // Добавить новый заказ
  addOrder(order: Omit<OrderRecord, 'id' | 'createdAt'>): string {
    const id = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newOrder: OrderRecord = {
      ...order,
      id,
      createdAt: new Date()
    };
    
    this.orders.push(newOrder);
    this.saveToStorage();
    return id;
  }

  // Обновить реальную цену заказа
  updateActualPrice(orderId: string, actualPrice: number, supplier?: string): boolean {
    const order = this.orders.find(o => o.id === orderId);
    if (order) {
      order.actualPrice = actualPrice;
      order.supplier = supplier;
      this.saveToStorage();
      return true;
    }
    return false;
  }

  // Найти похожие заказы
  findSimilarOrders(formData: Partial<FormData>, limit: number = 5): OrderRecord[] {
    const { productType, material, quantity, width, height, depth } = formData;
    
    return this.orders
      .filter(order => {
        // Базовые фильтры
        if (productType && order.productType !== productType) return false;
        if (material && !order.material.toLowerCase().includes(material.toLowerCase())) return false;
        
        // Фильтр по размеру (в пределах 20%)
        if (width && order.width) {
          const widthDiff = Math.abs(order.width - width) / width;
          if (widthDiff > 0.2) return false;
        }
        if (height && order.height) {
          const heightDiff = Math.abs(order.height - height) / height;
          if (heightDiff > 0.2) return false;
        }
        if (depth && order.depth) {
          const depthDiff = Math.abs(order.depth - depth) / depth;
          if (depthDiff > 0.2) return false;
        }
        
        return true;
      })
      .sort((a, b) => {
        // Сортировка по релевантности
        let scoreA = 0, scoreB = 0;
        
        // Приоритет заказов с реальными ценами
        if (a.actualPrice) scoreA += 10;
        if (b.actualPrice) scoreB += 10;
        
        // Приоритет по близости тиража
        if (quantity && a.quantity) {
          const quantityDiffA = Math.abs(a.quantity - quantity) / quantity;
          scoreA += 1 / (quantityDiffA + 0.1);
        }
        if (quantity && b.quantity) {
          const quantityDiffB = Math.abs(b.quantity - quantity) / quantity;
          scoreB += 1 / (quantityDiffB + 0.1);
        }
        
        return scoreB - scoreA;
      })
      .slice(0, limit);
  }

  // Получить статистику
  getStats(): {
    totalOrders: number;
    ordersWithActualPrices: number;
    averagePriceAccuracy: number;
    recentOrders: OrderRecord[];
  } {
    const ordersWithPrices = this.orders.filter(o => o.actualPrice);
    const recentOrders = this.orders
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 10);

    let totalAccuracy = 0;
    let accuracyCount = 0;
    
    ordersWithPrices.forEach(order => {
      if (order.actualPrice && order.pricePerUnit) {
        const accuracy = Math.abs(order.actualPrice - order.pricePerUnit) / order.actualPrice;
        totalAccuracy += accuracy;
        accuracyCount++;
      }
    });

    return {
      totalOrders: this.orders.length,
      ordersWithActualPrices: ordersWithPrices.length,
      averagePriceAccuracy: accuracyCount > 0 ? totalAccuracy / accuracyCount : 0,
      recentOrders
    };
  }

  // Экспорт данных для промпта
  exportForPrompt(formData: Partial<FormData>): string {
    const similarOrders = this.findSimilarOrders(formData, 3);
    
    if (similarOrders.length === 0) {
      return "База знаний пуста. Используй общие правила ценообразования.";
    }

    return `Похожие заказы из базы знаний:
${similarOrders.map(order => 
  `ID: ${order.id}, ${order.productType}, ${order.quantity}шт, ${order.pricePerUnit}¥/шт, ${order.width}x${order.height}x${order.depth}мм, ${order.material}${order.materialDensity ? ` ${order.materialDensity}г/м²` : ''}, ${order.printType || 'печать не указана'}${order.actualPrice ? ` (реальная цена: ${order.actualPrice}¥)` : ''}`
).join('\n')}`;
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.orders));
    } catch (error) {
      console.error('Ошибка сохранения базы знаний:', error);
    }
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        this.orders = JSON.parse(stored).map((order: any) => ({
          ...order,
          createdAt: new Date(order.createdAt)
        }));
      }
    } catch (error) {
      console.error('Ошибка загрузки базы знаний:', error);
      this.orders = [];
    }
  }

  // Очистить старые записи (старше 1 года)
  cleanup(): void {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    
    this.orders = this.orders.filter(order => order.createdAt > oneYearAgo);
    this.saveToStorage();
  }
}

export const knowledgeBase = new KnowledgeBase();
