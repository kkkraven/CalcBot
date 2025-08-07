import { useState } from "react";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Textarea } from "./ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "./ui/sheet";
import { CalculatorIcon } from "./CalculatorIcon";
import { Send, History, Trash2 } from "lucide-react";

interface HistoryItem {
  id: string;
  text: string;
  timestamp: Date;
}

export function PackagingCalculator() {
  const [orderDescription, setOrderDescription] = useState("");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!orderDescription.trim()) return;
    
    setIsSubmitting(true);
    
    // Добавляем в историю
    const newItem: HistoryItem = {
      id: Date.now().toString(),
      text: orderDescription,
      timestamp: new Date()
    };
    
    setHistory(prev => [newItem, ...prev]);
    
    // Имитация обработки запроса
    setTimeout(() => {
      setIsSubmitting(false);
      setOrderDescription("");
    }, 1500);
  };

  const clearHistory = () => {
    setHistory([]);
  };

  const exampleText = "Например: \"Пакет, медная бумага. Плотность 250 грамм. Зеркальный, с выпуклой ручкой.Размер 25x30x80мм, logo нанесение белое: лицевая 10x7,5см., оборотная - 14x0.5см. Количество 500\"";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-teal-500/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl"></div>
      </div>
      
      <div className="relative z-10 w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <CalculatorIcon className="w-12 h-12 text-teal-400 mr-3" />
            <h1 className="text-3xl text-white">Чат-Калькулятор Упаковки</h1>
          </div>
          <p className="text-gray-400">
            Опишите ваш заказ, и я рассчитаю примерную стоимость
          </p>
        </div>

        {/* Main card */}
        <Card className="backdrop-blur-xl bg-white/10 border-white/20 shadow-2xl">
          <CardContent className="p-8">
            <div className="text-center mb-6">
              <CalculatorIcon className="w-16 h-16 text-teal-400 mx-auto mb-4" />
              <h2 className="text-xl text-white mb-2">
                Начните описание вашего заказа упаковки
              </h2>
              <p className="text-sm text-gray-400 leading-relaxed">
                {exampleText}
              </p>
            </div>

            <div className="space-y-4">
              <div className="relative">
                <Textarea
                  value={orderDescription}
                  onChange={(e) => setOrderDescription(e.target.value)}
                  placeholder="Опишите ваш заказ упаковки..."
                  className="min-h-[120px] bg-white/10 border-white/30 text-white placeholder:text-gray-400 resize-none focus:border-teal-400 focus:ring-teal-400/30"
                />
                <Button
                  onClick={handleSubmit}
                  disabled={!orderDescription.trim() || isSubmitting}
                  className="absolute right-2 bottom-2 bg-teal-500 hover:bg-teal-600 text-white p-3 h-auto"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>

              <div className="flex justify-center">
                <Sheet>
                  <SheetTrigger asChild>
                    <Button variant="outline" className="bg-blue-500/20 border-blue-400/50 text-blue-300 hover:bg-blue-500/30">
                      <History className="w-4 h-4 mr-2" />
                      История запросов
                    </Button>
                  </SheetTrigger>
                  <SheetContent className="bg-white/95 backdrop-blur-xl">
                    <SheetHeader>
                      <SheetTitle className="flex items-center justify-between">
                        <span>История запросов</span>
                        {history.length > 0 && (
                          <Button
                            onClick={clearHistory}
                            variant="destructive"
                            size="sm"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Очистить историю
                          </Button>
                        )}
                      </SheetTitle>
                    </SheetHeader>
                    <div className="mt-6">
                      {history.length === 0 ? (
                        <p className="text-center text-gray-500 py-8">
                          История пока пуста
                        </p>
                      ) : (
                        <div className="space-y-4">
                          {history.map((item) => (
                            <div
                              key={item.id}
                              className="p-4 bg-gray-50 rounded-lg border"
                            >
                              <p className="text-sm text-gray-700 mb-2">
                                {item.text}
                              </p>
                              <p className="text-xs text-gray-500">
                                {item.timestamp.toLocaleString('ru-RU')}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </SheetContent>
                </Sheet>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-sm text-gray-500">
            © 2025 Factura Textile AI Studio · Все расчеты являются предварительными
          </p>
        </div>
      </div>
    </div>
  );
}