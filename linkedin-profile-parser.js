function getAbout(json) {
    const aboutComponent = json?.included?.find((d) =>
      d.entityUrn?.includes("ABOUT")
    );
    return aboutComponent?.topComponents?.[1]?.components?.textComponent?.text
      ?.text;
  }
  
  function getExperience(json) {
    const experienceEntity = json?.included?.find(
      (d) =>
        !d?.entityUrn?.includes("VOLUNTEERING_EXPERIENCE") &&
        d?.entityUrn?.includes("EXPERIENCE")
    );
  
    return experienceEntity?.topComponents?.[1].components?.fixedListComponent?.components?.map(
      (e) => {
        const entity = e?.components?.entityComponent;
        return {
          title: entity?.title?.text,
          companyName: entity?.subtitle?.text,
          description:
            entity?.subComponents?.components?.[0]?.components?.fixedListComponent
              ?.components?.[0]?.components?.textComponent?.text?.text,
          dates: entity?.caption?.text,
          location: entity?.metadata?.text,
          companyUrl: entity?.image?.actionTarget,
        };
      }
    );
  }
  
  function getVolunteering(json) {
    const volunteeringEntity = json?.included?.find((d) =>
      d?.entityUrn?.includes("VOLUNTEERING_EXPERIENCE")
    );
  
    if (volunteeringEntity?.topComponents.length === 0) {
      return [];
    }
  
    return volunteeringEntity?.topComponents?.[1]?.components?.fixedListComponent?.components?.map(
      (e) => {
        const entity = e?.components?.entityComponent;
        return {
          title: entity?.title?.text,
          companyName: entity?.subtitle?.text,
          description:
            entity?.subComponents?.components?.[0]?.components?.textComponent
              ?.text?.text,
          dates: entity?.caption?.text,
          location: entity?.metadata?.text,
          companyUrl: entity?.image?.actionTarget,
        };
      }
    );
  }
  
  function getEducation(json) {
    const educationComponent = json?.included?.find((d) => {
      return d?.entityUrn?.includes("EDUCATION");
    });
  
    if (educationComponent?.topComponents.length === 0) {
      return [];
    }
  
    return educationComponent?.topComponents?.[1]?.components?.fixedListComponent?.components?.map(
      (e) => {
        const entity = e?.components?.entityComponent;
        return {
          schoolName: entity?.title?.text,
          degree: entity?.subtitle?.text,
          description:
            entity?.subComponents?.components?.[0]?.components?.insightComponent
              ?.text?.text?.text,
          dates: entity?.caption?.text,
          schoolUrl: entity?.image?.actionTarget,
        };
      }
    );
  }
  
  function getLocation(json) {
    const locationComponent = json?.included?.find(
      (d) =>
        !d?.entityUrn?.includes("VOLUNTEERING_EXPERIENCE") &&
        d?.entityUrn?.includes("EXPERIENCE")
    );
    return locationComponent?.topComponents[1]?.components?.fixedListComponent
      ?.components?.[1]?.components?.entityComponent?.metadata?.text;
  }
  
  async function getMiddleProfile(profileId) {
    try {
      const res = await fetch(
        `https://www.linkedin.com/voyager/api/graphql?includeWebMetadata=true&variables=(profileUrn:urn%3Ali%3Afsd_profile%3A${profileId})&&queryId=voyagerIdentityDashProfileCards.2d68c43b54ee24f8de25bc423c3cf7e4`,
        {
          headers: {
            accept: "application/vnd.linkedin.normalized+json+2.1",
            "accept-language": "en-US,en-CA;q=0.9,en-AU;q=0.8,en;q=0.7",
            "csrf-token": "ajax:1690738384797705558",
            "sec-ch-ua":
              '"Not?A_Brand";v="8", "Chromium";v="108", "Google Chrome";v="108"',
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"macOS"',
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            cookie:
            'AQEFAHUBAAAAABEkMHcAAAGVOY_gxwAAAZXqRwSfVgAAGHVybjpsaTptZW1iZXI6MTA5MDUyODAxNg8IXEA_pmtzWzGbDYed4NabyXQjrR',
            Referer: "https://www.linkedin.com/in/cyprien-toffa-aa9040171/",
            "Referrer-Policy": "strict-origin-when-cross-origin",
          },
          body: null,
          method: "GET",
        }
      );
      const json = await res.json();
  
      return {
        location: getLocation(json),
        about: getAbout(json),
        experience: getExperience(json),
        education: getEducation(json),
        volunteering: getVolunteering(json),
      };
    } catch (error) {
      console.log("error at middleProfile", error.message);
    }
  }
  
  async function getTopProfile(handle) {
    try {
      const res = await fetch(
        `https://www.linkedin.com/voyager/api/identity/dash/profiles?q=memberIdentity&memberIdentity=${handle}&decorationId=com.linkedin.voyager.dash.deco.identity.profile.TopCardSupplementary-128`,
        {
          headers: {
            accept: "application/vnd.linkedin.normalized+json+2.1",
            "accept-language": "en-US,en-CA;q=0.9,en-AU;q=0.8,en;q=0.7",
            "sec-ch-ua":
              '"Google Chrome";v="113", "Chromium";v="113", "Not-A.Brand";v="24"',
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"macOS"',
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-origin",
            cookie:
              'AQEFAHUBAAAAABEkMHcAAAGVOY_gxwAAAZXqRwSfVgAAGHVybjpsaTptZW1iZXI6MTA5MDUyODAxNg8IXEA_pmtzWzGbDYed4NabyXQjrR',
            Referer: "https://www.linkedin.com/in/adrianhorning/",
            "Referrer-Policy": "strict-origin-when-cross-origin",
          },
          body: null,
          method: "GET",
        }
      );
      const data = await res.json();
  
      const entityWithAllTheData = data?.included?.find(
        (d) => d?.publicIdentifier && d?.publicIdentifier !== "adrianhorning"
      );
      const thingWithProfileId =
        entityWithAllTheData?.profileStatefulProfileActions?.overflowActions?.find(
          (d) => {
            return d?.report?.authorProfileId;
          }
        );
      return {
        firstName: entityWithAllTheData?.firstName,
        lastName: entityWithAllTheData?.lastName,
        headline: entityWithAllTheData?.headline,
        handle: entityWithAllTheData?.publicIdentifier,
        url: `https://www.linkedin.com/in/${entityWithAllTheData?.publicIdentifier}/`,
        publicIdentifier: entityWithAllTheData?.publicIdentifier,
        profileId: thingWithProfileId?.report?.authorProfileId,
      };
    } catch (error) {
      console.log("error at topProfile", error.message);
    }
  }
  
  export async function getLinkedinPage(url) {
    const handle = url.split("/in/")[1].split("/")[0];
    console.log("handle", handle);
  
    const topProfile = await getTopProfile(handle);
    const middle = await getMiddleProfile(topProfile?.profileId);
    // const recentActivity = await getRecentActivity(topProfile?.profileId);
    const profile = {
      ...topProfile,
      ...middle,
    //   recentActivity,
    };
    return profile;
  }