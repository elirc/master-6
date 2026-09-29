const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export type Session = {
  token: string;
  organizationId: string;
};

export async function apiGet<T>(path: string, session?: Session): Promise<T> {
  const init: RequestInit = { cache: "no-store" };
  if (session) {
    init.headers = {
      Authorization: `Bearer ${session.token}`,
      "x-organization-id": session.organizationId
    };
  }

  const response = await fetch(`${apiBaseUrl}${path}`, init);

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}
