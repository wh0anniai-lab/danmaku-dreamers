# Bullet Blossom

총알 피하기 게임을 만들려고 한다. 참조할만한 레퍼런스는 동방 프로젝트인 탄막 슈팅 게임을 만들려고 한다. 일단 캐릭터는 한개로 만들고, 난이도는 동방 프로젝트처럼 어려워야하는데 5초 마다 단계적으로 어려워지면서 총 45초 시점에 스테이지 보스가 나오고 보스를 처치하면 스테이지를 클리어하는 방식.  캐릭터는 스킬을 사용할 수 있는데, q,w,e,r 로 스킬을 사용하고, q는 강화된 발출기, w 는 방어막, e 는 총알 자동으로 1초동안 피해주는 기술로 하고, r은 게이지가 차면 사용할 수 있으며 5초마다 게이지가 가득차는 것을 조건으로 한다. r을 사용하면 캐릭터가 스킬을 시전하는 모션이 크게 보이며, 화면의 모든 미사일이 다 없어진다. 캐릭터 디자인은 동방 프로젝트처럼 미소녀의 스타일로 디자인한다. 목숨은 총 3목숨이고, 조작은 방향키로 조작한다.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://danmaku-dreamers.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/3fb44bb1-59ac-4932-89be-a048756072ba).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
