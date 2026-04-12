import API from "./axios";

export async function revealGroupCredentials(groupId) {
  const tokenResponse = await API.post("credentials/request-reveal/", {
    group_id: groupId,
  });

  const revealResponse = await API.post("credentials/reveal/", {
    reveal_token: tokenResponse.data.reveal_token,
  });

  return revealResponse.data?.credentials;
}
