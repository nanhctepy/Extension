(async ()=>{
  const REMOTE_URL = "https://raw.githubusercontent.com/nanhctepy/Extension/refs/heads/main/edx.txt";

  async function getRemoteKey(){
    const res = await fetch(REMOTE_URL + "?_=" + Date.now());
    if(!res.ok) throw new Error("Không lấy được license");
    return (await res.text()).trim();
  }

  async function getUserKey(){
    let key = localStorage.getItem("mykey");
    if(!key){
      key = prompt("Nhập key để kích hoạt extension:");
      localStorage.setItem("mykey", key);
    }
    return key.trim();
  }

  try {
    const [remoteKey, userKey] = await Promise.all([getRemoteKey(), getUserKey()]);
    if(remoteKey !== userKey){
      alert("Key không hợp lệ!");
      throw new Error("Invalid key");
    }
    console.log("License hợp lệ. Extension hoạt động bình thường.");
  } catch(e){
    console.error("License check failed:", e);
    throw e;
  }
})();
