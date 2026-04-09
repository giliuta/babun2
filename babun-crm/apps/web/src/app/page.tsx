export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="text-center space-y-6">
        <div className="flex items-center justify-center gap-3">
          <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center">
            <span className="text-white text-2xl font-bold">B</span>
          </div>
          <h1 className="text-4xl font-bold text-gray-900">Babun CRM</h1>
        </div>
        <p className="text-lg text-gray-500 max-w-md">
          Система управления записями, клиентами и бригадами для AirFix
        </p>
        <div className="flex gap-3 justify-center">
          <a
            href="/login"
            className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors"
          >
            Войти
          </a>
        </div>
        <div className="pt-8 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-400">
          <div className="p-3 bg-white rounded-lg border">
            <div className="text-2xl font-bold text-gray-900">903+</div>
            <div>Клиентов</div>
          </div>
          <div className="p-3 bg-white rounded-lg border">
            <div className="text-2xl font-bold text-gray-900">2</div>
            <div>Бригады</div>
          </div>
          <div className="p-3 bg-white rounded-lg border">
            <div className="text-2xl font-bold text-gray-900">26</div>
            <div>Услуг</div>
          </div>
          <div className="p-3 bg-white rounded-lg border">
            <div className="text-2xl font-bold text-gray-900">4</div>
            <div>Города</div>
          </div>
        </div>
      </div>
    </main>
  );
}
