import React, { useEffect, useState } from "react";
import api from "../utils/api";
import {
  Mail,
  CheckCircle,
  XCircle,
  Filter,
  Search,
  Download,
} from "lucide-react";

const Logs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const fetchLogs = async () => {
    try {
      const res = await api.get("/logs");
      setLogs(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter((log) => {
    const matchesFilter = filter === "all" || log.status === filter;
    const matchesSearch =
      !search ||
      log.leads?.name.toLowerCase().includes(search.toLowerCase()) ||
      log.leads?.email.toLowerCase().includes(search.toLowerCase()) ||
      log.campaigns?.name.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-white mb-2">
            Activity Logs
          </h2>
          <p className="text-gray-400 text-sm">
            Full history of sent and failed outreach emails.
          </p>
        </div>
        <button className="btn btn-secondary flex items-center gap-2 text-xs w-full md:w-auto justify-center">
          <Download size={14} /> Export CSV
        </button>
      </header>

      <div className="flex flex-col md:flex-row gap-4 items-center justify-between glass p-4 rounded-2xl">
        <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
          {["all", "sent", "failed"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
                filter === f
                  ? "bg-primary text-white"
                  : "text-gray-500 hover:text-white"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="relative w-full md:w-96">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
          />
          <input
            className="input w-full pl-10"
            placeholder="Search leads, campaigns or emails..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="glass rounded-3xl overflow-hidden border border-border/50">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px] md:min-w-full">
            <thead>
              <tr className="bg-card/80 border-b border-border">
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">
                  Event
                </th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">
                  Campaign
                </th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">
                  Lead
                </th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase text-right">
                  Sent At
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-card/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-2 rounded-lg ${log.status === "sent" ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"}`}
                      >
                        <Mail size={16} />
                      </div>
                      <span className="text-sm font-bold text-white capitalize">
                        {log.type.replace("_", " ")}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-400">
                    {log.campaigns?.name}
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-bold text-white">
                      {log.leads?.name}
                    </p>
                    <p className="text-[10px] text-gray-500 font-mono">
                      {log.leads?.email}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {log.status === "sent" ? (
                        <CheckCircle size={14} className="text-green-500" />
                      ) : (
                        <XCircle size={14} className="text-red-500" />
                      )}
                      <span
                        className={`text-xs font-bold uppercase ${log.status === "sent" ? "text-green-500" : "text-red-500"}`}
                      >
                        {log.status}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right text-xs text-gray-500 font-mono">
                    {new Date(log.sent_at).toLocaleString()}
                  </td>
                </tr>
              ))}
              {filteredLogs.length === 0 && !loading && (
                <tr>
                  <td
                    colSpan="5"
                    className="px-6 py-20 text-center text-gray-500"
                  >
                    No logs found matching your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Logs;
