export default function Unauthorized() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-800 mb-4">403</h1>
        <p className="text-xl text-gray-600 mb-8">ليس لديك صلاحية للوصول إلى هذه الصفحة</p>
        <a href="/login" className="text-blue-600 hover:underline">
          العودة إلى صفحة تسجيل الدخول
        </a>
      </div>
    </div>
  );
}
