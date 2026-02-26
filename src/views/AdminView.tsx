import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X } from "lucide-react";
import { User } from "../types";

export function AdminView() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<User>>({});
  const [uploadName, setUploadName] = useState("");
  const [uploadText, setUploadText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    const res = await fetch("/api/admin/users");
    const data = await res.json();
    if (data.success) {
      setUsers(data.users);
    }
  };

  const handleStatusChange = async (
    id: number,
    status: "approved" | "rejected",
  ) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        fetchUsers();
      } else {
        alert("操作失败");
      }
    } catch (err) {
      alert("网络错误");
    } finally {
      setLoading(false);
    }
  };

  const handleHide = async (id: number, isHidden: boolean) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${id}/hide`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isHidden }),
      });
      if (res.ok) {
        fetchUsers();
      } else {
        alert("操作失败");
      }
    } catch (err) {
      alert("网络错误");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("确定要删除该角色吗？删除后将无法恢复。")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchUsers();
      } else {
        const data = await res.json();
        alert(`操作失败: ${data.message || '未知错误'}`);
      }
    } catch (err: any) {
      alert(`网络错误: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!selectedUser) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: editData.role,
          mentalRank: editData.mentalRank,
          physicalRank: editData.physicalRank,
          ability: editData.ability,
          spiritName: editData.spiritName,
          profileText: editData.profileText,
        }),
      });
      if (res.ok) {
        alert("保存成功");
        setIsEditing(false);
        fetchUsers();
        setSelectedUser({ ...selectedUser, ...editData } as User);
      } else {
        alert("保存失败");
      }
    } catch (err) {
      alert("网络错误");
    } finally {
      setLoading(false);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadName.trim()) {
      alert("请输入名字");
      return;
    }

    const file = fileInputRef.current?.files?.[0];
    if (!uploadText.trim() && !file) {
      alert("请输入文本资料或上传图片资料");
      return;
    }

    setLoading(true);

    let imageBase64 = "";
    let mimeType = "";

    if (file) {
      const reader = new FileReader();
      const fileReadPromise = new Promise<void>((resolve) => {
        reader.onload = (event) => {
          imageBase64 = event.target?.result as string;
          mimeType = file.type;
          resolve();
        };
      });
      reader.readAsDataURL(file);
      await fileReadPromise;
    }

    try {
      const res = await fetch("/api/admin/upload-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: uploadName.trim(),
          text: uploadText,
          imageBase64,
          mimeType,
        }),
      });

      const data = await res.json();
      if (data.success) {
        alert("资料上传成功！");
        setShowUploadModal(false);
        setUploadName("");
        setUploadText("");
        if (fileInputRef.current) fileInputRef.current.value = "";
        fetchUsers();
      } else {
        alert(data.message || "上传失败");
      }
    } catch (err) {
      alert("网络错误");
    } finally {
      setLoading(false);
    }
  };

  const mainUsers = users.filter((u) => u.status !== "dead");
  const deadUsers = users.filter((u) => u.status === "dead");

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">
            管理员控制台
          </h1>
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-500 bg-white px-4 py-2 rounded-full shadow-sm border border-gray-200">
              共 {users.length} 名用户
            </div>
            <button
              onClick={() => (window.location.href = "/")}
              className="px-4 py-2 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 transition-colors shadow-sm text-sm"
            >
              进入游戏
            </button>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden mb-8">
          <div className="p-4 border-b border-gray-100 bg-gray-50/50">
            <h2 className="font-bold text-gray-900">活体档案</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-sm text-gray-500">
                  <th className="p-4 font-medium">ID</th>
                  <th className="p-4 font-medium">名字</th>
                  <th className="p-4 font-medium">身份</th>
                  <th className="p-4 font-medium">状态</th>
                  <th className="p-4 font-medium">详细信息</th>
                  <th className="p-4 font-medium text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {mainUsers.map((user) => (
                  <tr
                    key={user.id}
                    className="hover:bg-gray-50/50 transition-colors"
                  >
                    <td className="p-4 text-gray-500">#{user.id}</td>
                    <td className="p-4 font-bold text-gray-900">{user.name}</td>
                    <td className="p-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                        {user.role || "未分化"}
                      </span>
                    </td>
                    <td className="p-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border
                        ${user.status === "pending" ? "bg-amber-50 text-amber-700 border-amber-100" : ""}
                        ${user.status === "approved" ? "bg-emerald-50 text-emerald-700 border-emerald-100" : ""}
                        ${user.status === "rejected" ? "bg-red-50 text-red-700 border-red-100" : ""}
                        ${user.status === "ghost" ? "bg-purple-50 text-purple-700 border-purple-100" : ""}
                      `}
                      >
                        {user.status === "pending" && "待审核"}
                        {user.status === "approved" && "已过审"}
                        {user.status === "rejected" && "已拒绝"}
                        {user.status === "ghost" && "鬼魂"}
                      </span>
                    </td>
                    <td className="p-4">
                      <button
                        onClick={() => {
                          setSelectedUser(user);
                          setEditData(user);
                          setIsEditing(false);
                          setShowDetailsModal(true);
                        }}
                        className="text-sky-600 hover:text-sky-800 font-medium text-xs"
                      >
                        查看
                      </button>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {user.status === "pending" && (
                          <>
                            <button
                              onClick={() => {
                                setUploadName(user.name);
                                setUploadText(user.profileText || "");
                                setShowUploadModal(true);
                              }}
                              disabled={loading}
                              className="px-3 py-1.5 bg-sky-600 text-white rounded-lg font-medium hover:bg-sky-700 transition-colors disabled:opacity-50 text-xs shadow-sm"
                            >
                              上传资料
                            </button>
                            <button
                              onClick={() =>
                                handleStatusChange(user.id, "approved")
                              }
                              disabled={loading}
                              className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 text-xs shadow-sm"
                            >
                              通过
                            </button>
                            <button
                              onClick={() =>
                                handleStatusChange(user.id, "rejected")
                              }
                              disabled={loading}
                              className="px-3 py-1.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50 text-xs shadow-sm"
                            >
                              拒绝
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => handleDelete(user.id)}
                          disabled={loading}
                          className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg font-medium hover:bg-red-100 transition-colors disabled:opacity-50 text-xs shadow-sm border border-red-100"
                        >
                          删除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {mainUsers.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-gray-400">
                      暂无活体档案
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Death List */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-100 bg-gray-50/50">
            <h2 className="font-bold text-gray-900">死亡名单</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-sm text-gray-500">
                  <th className="p-4 font-medium">ID</th>
                  <th className="p-4 font-medium">名字</th>
                  <th className="p-4 font-medium">死亡描述</th>
                  <th className="p-4 font-medium">状态</th>
                  <th className="p-4 font-medium text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {deadUsers.map((user) => (
                  <tr
                    key={user.id}
                    className="hover:bg-gray-50/50 transition-colors"
                  >
                    <td className="p-4 text-gray-500">#{user.id}</td>
                    <td className="p-4 font-bold text-gray-900">{user.name}</td>
                    <td className="p-4 text-gray-600 max-w-xs truncate" title={user.deathDescription}>
                      {user.deathDescription || "-"}
                    </td>
                    <td className="p-4">
                      {user.isHidden ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
                          已隐藏
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
                          显示中
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleHide(user.id, !user.isHidden)}
                          disabled={loading}
                          className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors disabled:opacity-50 text-xs shadow-sm"
                        >
                          {user.isHidden ? "取消隐藏" : "隐藏"}
                        </button>
                        <button
                          onClick={() => handleDelete(user.id)}
                          disabled={loading}
                          className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg font-medium hover:bg-red-100 transition-colors disabled:opacity-50 text-xs shadow-sm border border-red-100"
                        >
                          删除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {deadUsers.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-gray-400">
                      暂无死亡记录
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Details Modal */}
      <AnimatePresence>
        {showDetailsModal && selectedUser && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-3xl p-6 w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
                <h3 className="text-2xl font-black text-gray-900">
                  角色档案：{selectedUser.name}
                </h3>
                <div className="flex items-center gap-4">
                  {!isEditing ? (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="px-4 py-2 bg-sky-600 text-white rounded-xl font-medium hover:bg-sky-700 transition-colors text-sm"
                    >
                      编辑
                    </button>
                  ) : (
                    <button
                      onClick={handleSaveEdit}
                      disabled={loading}
                      className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors text-sm"
                    >
                      保存
                    </button>
                  )}
                  <button
                    onClick={() => setShowDetailsModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X size={24} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6">
                <div className="space-y-4">
                  <ProfileField label="姓名" value={selectedUser.name} />
                  {isEditing ? (
                    <>
                      <EditField
                        label="所属人群"
                        value={editData.role}
                        onChange={(v) => setEditData({ ...editData, role: v })}
                      />
                      <EditField
                        label="精神力"
                        value={editData.mentalRank}
                        onChange={(v) => setEditData({ ...editData, mentalRank: v })}
                      />
                      <EditField
                        label="肉体强度"
                        value={editData.physicalRank}
                        onChange={(v) => setEditData({ ...editData, physicalRank: v })}
                      />
                      <EditField
                        label="能力"
                        value={editData.ability}
                        onChange={(v) => setEditData({ ...editData, ability: v })}
                      />
                      <EditField
                        label="精神体"
                        value={editData.spiritName}
                        onChange={(v) => setEditData({ ...editData, spiritName: v })}
                      />
                      <EditField
                        label="个人资料"
                        value={editData.profileText}
                        onChange={(v) => setEditData({ ...editData, profileText: v })}
                        isLong
                      />
                    </>
                  ) : (
                    <>
                      <ProfileField
                        label="所属人群"
                        value={selectedUser.role || "未分化"}
                      />
                      <ProfileField
                        label="精神力"
                        value={selectedUser.mentalRank}
                      />
                      <ProfileField
                        label="肉体强度"
                        value={selectedUser.physicalRank}
                      />
                      <ProfileField label="能力" value={selectedUser.ability} />
                      <ProfileField
                        label="精神体"
                        value={selectedUser.spiritName}
                      />
                      <ProfileField
                        label="个人资料"
                        value={selectedUser.profileText}
                        isLong
                      />
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Upload Modal */}
      <AnimatePresence>
        {showUploadModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl"
            >
              <h2 className="text-xl font-black mb-4 text-gray-900">
                上传玩家资料
              </h2>
              <form onSubmit={handleUploadSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    玩家名字
                  </label>
                  <input
                    type="text"
                    value={uploadName}
                    readOnly
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl bg-gray-50 text-gray-500 cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    文本资料 (可选)
                  </label>
                  <textarea
                    value={uploadText}
                    onChange={(e) => setUploadText(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-100 focus:border-sky-700 h-32 resize-none"
                    placeholder="输入玩家的详细资料..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    图片资料 (可选，将自动识别文字)
                  </label>
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-sky-50 file:text-sky-700 hover:file:bg-sky-100"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowUploadModal(false)}
                    className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-2.5 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
                  >
                    提交资料
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-[60] flex items-center justify-center">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-gray-900 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-900 font-medium">处理中，请稍候...</p>
          </div>
        </div>
      )}
    </div>
  );
}

function ProfileField({
  label,
  value,
  isLong,
}: {
  label: string;
  value?: string;
  isLong?: boolean;
}) {
  return (
    <div
      className={`bg-gray-50 rounded-xl p-3 border border-gray-100 ${isLong ? "h-full" : ""}`}
    >
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className="text-sm font-medium text-gray-900 whitespace-pre-wrap">
        {value || "未知"}
      </div>
    </div>
  );
}

function EditField({
  label,
  value,
  onChange,
  isLong,
}: {
  label: string;
  value?: string;
  onChange: (val: string) => void;
  isLong?: boolean;
}) {
  return (
    <div
      className={`bg-gray-50 rounded-xl p-3 border border-gray-200 focus-within:border-sky-500 focus-within:ring-1 focus-within:ring-sky-500 ${isLong ? "h-full" : ""}`}
    >
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      {isLong ? (
        <textarea
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-transparent text-sm font-medium text-gray-900 focus:outline-none resize-y min-h-[100px]"
        />
      ) : (
        <input
          type="text"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-transparent text-sm font-medium text-gray-900 focus:outline-none"
        />
      )}
    </div>
  );
}
