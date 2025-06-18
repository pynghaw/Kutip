import CameraViewer from "@/components/CameraViewer"
import UserAddressCard from "@/components/user-profile/UserAddressCard"
import UserInfoCard    from "@/components/user-profile/UserInfoCard"
import UserMetaCard    from "@/components/user-profile/UserMetaCard"
import { Metadata }    from "next"
import React           from "react"

export const metadata: Metadata = {
  title: "Next.js Profile | TailAdmin",
  description: "Profile page with live bin‐plate detection",
}

export default function Profile() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border p-5 bg-white dark:bg-gray-900">
        <h3 className="mb-5 text-lg font-semibold">Profile</h3>
        <UserMetaCard />
        <UserInfoCard />
        <UserAddressCard />
      </div>

      {/* New section for live camera */}
      <div className="rounded-2xl border p-5 bg-white dark:bg-gray-900">
        <h3 className="mb-5 text-lg font-semibold">Live Bin Plate Detection</h3>
        <CameraViewer />
      </div>
    </div>
  )
}
