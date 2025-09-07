interface StatsCardProps {
  title: string;
  value: string;
  description: string;
  color: string;
}

export default function StatsCard({ title, value, description, color }: StatsCardProps) {
  return (
    <div className="bg-white overflow-hidden shadow-lg rounded-lg">
      <div className="p-5">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <div className={`${color} rounded-md p-3`}>
              <div className="h-6 w-6 text-white">
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
            </div>
          </div>
          <div className="ml-5 w-0 flex-1">
            <dl>
              <dt className="text-sm font-medium text-gray-500 truncate">{title}</dt>
              <dd className="flex items-baseline">
                <div className="text-2xl font-semibold text-gray-900">{value}</div>
              </dd>
              <dd className="text-sm text-gray-600">{description}</dd>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}